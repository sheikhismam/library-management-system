from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.books.models import Book
from apps.members.models import Member
from .models import Borrowing, Fine, Reservation
from apps.audit_logs.utils import log_activity


def resolve_book(identifier: str) -> Book:
    """
    Resolve a Book from ID, ISBN, or QR code payload.
    """
    clean_id = str(identifier).strip()
    if clean_id.startswith('LMS:BOOK:'):
        clean_id = clean_id.replace('LMS:BOOK:', '').strip()
    elif clean_id.startswith('BOOK:'):
        clean_id = clean_id.replace('BOOK:', '').strip()

    if clean_id.isdigit():
        try:
            return Book.objects.get(id=int(clean_id))
        except Book.DoesNotExist:
            pass

    try:
        return Book.objects.get(isbn__iexact=clean_id)
    except Book.DoesNotExist:
        raise ValidationError({'book_identifier': f'No book found matching: {identifier}'})


def resolve_member(identifier: str) -> Member:
    """
    Resolve a Member from ID, Member Code, QR code payload, email, or phone.
    """
    clean_id = str(identifier).strip()
    if clean_id.startswith('LMS:MEMBER:'):
        clean_id = clean_id.replace('LMS:MEMBER:', '').strip()
    elif clean_id.startswith('MEMBER:'):
        clean_id = clean_id.replace('MEMBER:', '').strip()

    if clean_id.isdigit():
        try:
            return Member.objects.get(id=int(clean_id))
        except Member.DoesNotExist:
            pass

    try:
        return Member.objects.get(member_code__iexact=clean_id)
    except Member.DoesNotExist:
        pass

    try:
        return Member.objects.get(email__iexact=clean_id)
    except (Member.DoesNotExist, Member.MultipleObjectsReturned):
        pass

    try:
        return Member.objects.get(phone__iexact=clean_id)
    except (Member.DoesNotExist, Member.MultipleObjectsReturned):
        raise ValidationError({'member_identifier': f'No member found matching: {identifier}'})


def issue_book_service(book_identifier, member_identifier, loan_days=14, notes='', actor=None, request=None):
    """
    Safely issue a book with atomic concurrency locks and stock validation.
    """
    book_target = resolve_book(book_identifier)
    member_target = resolve_member(member_identifier)

    with transaction.atomic():
        # Lock the book row to prevent concurrent race conditions
        book = Book.objects.select_for_update().get(id=book_target.id)
        member = Member.objects.select_for_update().get(id=member_target.id)

        # 1. Book active check
        if not book.is_active:
            raise ValidationError({'book': f'The book "{book.title}" is currently deactivated.'})

        # 2. Stock availability check
        if book.available_copies <= 0:
            raise ValidationError({'book': f'No copies available for "{book.title}". Current stock: 0.'})

        # 3. Member active status check
        if member.membership_status != 'ACTIVE':
            raise ValidationError({'member': f'Member {member.full_name} has membership status: {member.get_membership_status_display()}. Only ACTIVE members can borrow.'})

        # 4. Member borrowing limit check
        active_loans = Borrowing.objects.filter(member=member, status__in=['BORROWED', 'OVERDUE']).count()
        if active_loans >= member.max_borrow_limit:
            raise ValidationError({'member': f'Member {member.full_name} has reached the maximum borrowing limit of {member.max_borrow_limit} books.'})

        # 5. Duplicate loan check
        existing_loan = Borrowing.objects.filter(
            book=book,
            member=member,
            status__in=['BORROWED', 'OVERDUE']
        ).first()
        if existing_loan:
            raise ValidationError({'borrowing': f'Member {member.full_name} already has an active loan for "{book.title}".'})

        # 6. Create Borrowing
        borrow_now = timezone.now()
        due_date = borrow_now + timedelta(days=loan_days)
        borrowing = Borrowing.objects.create(
            book=book,
            member=member,
            borrow_date=borrow_now,
            due_date=due_date,
            status='BORROWED',
            notes=notes
        )

        # 7. Atomically decrement copies
        book.available_copies -= 1
        book.save(update_fields=['available_copies', 'updated_at'])

        # 8. Audit Log
        log_activity(
            request=request,
            user=actor,
            action='CHECKOUT',
            entity_type='Borrowing',
            entity_id=borrowing.id,
            details={
                'book_title': book.title,
                'book_isbn': book.isbn,
                'member_name': member.full_name,
                'member_code': member.member_code,
                'due_date': due_date.isoformat(),
                'available_copies_remaining': book.available_copies
            }
        )

        return borrowing


def return_book_service(borrowing_id=None, book_identifier=None, member_identifier=None, notes='', actor=None, request=None):
    """
    Safely process book check-in with atomic stock replenishment and automated fine calculation.
    """
    with transaction.atomic():
        borrowing = None

        if borrowing_id:
            try:
                borrowing = Borrowing.objects.select_for_update().select_related('book', 'member').get(id=borrowing_id)
            except Borrowing.DoesNotExist:
                raise ValidationError({'borrowing_id': f'No borrowing record found with ID: {borrowing_id}'})
        else:
            if not book_identifier:
                raise ValidationError({'error': 'Either borrowing_id or book_identifier must be provided.'})

            book = resolve_book(book_identifier)
            query = Borrowing.objects.select_for_update().select_related('book', 'member').filter(
                book=book,
                status__in=['BORROWED', 'OVERDUE']
            )

            if member_identifier:
                member = resolve_member(member_identifier)
                query = query.filter(member=member)

            borrowing_count = query.count()
            if borrowing_count == 0:
                raise ValidationError({'book_identifier': f'No active loans found for book: {book.title}'})
            elif borrowing_count > 1:
                raise ValidationError({'member_identifier': f'Multiple active loans found for "{book.title}". Please specify the member identifier or borrowing ID.'})
            
            borrowing = query.first()

        # Check if already returned
        if borrowing.status == 'RETURNED':
            raise ValidationError({'status': 'This loan has already been marked as returned.'})

        # Lock book
        book = Book.objects.select_for_update().get(id=borrowing.book.id)
        if book.available_copies >= book.total_copies:
            raise ValidationError({'stock': f'Cannot return book: available copies ({book.available_copies}) already equal total copies ({book.total_copies}).'})

        # Mark loan as returned
        return_time = timezone.now()
        borrowing.status = 'RETURNED'
        borrowing.return_date = return_time
        if notes:
            borrowing.notes = f"{borrowing.notes}\nReturn note: {notes}".strip()
        borrowing.save()

        # Replenish stock
        book.available_copies += 1
        book.save(update_fields=['available_copies', 'updated_at'])

        # Overdue fine evaluation
        created_fine = None
        if return_time > borrowing.due_date:
            delta = return_time - borrowing.due_date
            overdue_days = max(1, delta.days)
            daily_rate = Decimal('1.00')
            fine_amount = Decimal(overdue_days) * daily_rate

            created_fine = Fine.objects.create(
                borrowing=borrowing,
                member=borrowing.member,
                amount=fine_amount,
                daily_rate=daily_rate,
                status='PENDING',
                reason=f'Returned {overdue_days} day(s) late (Due: {borrowing.due_date.strftime("%Y-%m-%d")})'
            )

        # Audit Log
        log_activity(
            request=request,
            user=actor,
            action='CHECKIN',
            entity_type='Borrowing',
            entity_id=borrowing.id,
            details={
                'book_title': book.title,
                'book_isbn': book.isbn,
                'member_name': borrowing.member.full_name,
                'return_date': return_time.isoformat(),
                'was_overdue': created_fine is not None,
                'fine_amount': str(created_fine.amount) if created_fine else '0.00',
                'available_copies_now': book.available_copies
            }
        )

        return borrowing, created_fine


def renew_loan_service(borrowing_id, additional_days=14, notes='', actor=None, request=None):
    """
    Safely extend loan due date with max renewal limit validation.
    """
    with transaction.atomic():
        try:
            borrowing = Borrowing.objects.select_for_update().select_related('book', 'member').get(id=borrowing_id)
        except Borrowing.DoesNotExist:
            raise ValidationError({'borrowing_id': f'No borrowing record found with ID: {borrowing_id}'})

        if borrowing.status == 'RETURNED':
            raise ValidationError({'status': 'Cannot renew a loan that has already been returned.'})

        if borrowing.renewal_count >= borrowing.max_renewals:
            raise ValidationError({'renewal_count': f'Maximum renewals reached ({borrowing.max_renewals}). Further extensions are not allowed.'})

        # Check pending reservations queue
        pending_reservations = Reservation.objects.filter(book=borrowing.book, status='PENDING').count()
        if pending_reservations > 0 and borrowing.book.available_copies == 0:
            # If other members are in the reservation queue, prevent renewal
            raise ValidationError({'reservation': f'Cannot renew: there are {pending_reservations} pending reservation(s) waiting for this book.'})

        base_time = max(borrowing.due_date, timezone.now())
        borrowing.due_date = base_time + timedelta(days=additional_days)
        borrowing.renewal_count += 1
        if borrowing.status == 'OVERDUE' and borrowing.due_date > timezone.now():
            borrowing.status = 'BORROWED'

        if notes:
            borrowing.notes = f"{borrowing.notes}\nRenewal note: {notes}".strip()
        borrowing.save()

        # Audit Log
        log_activity(
            request=request,
            user=actor,
            action='RENEW',
            entity_type='Borrowing',
            entity_id=borrowing.id,
            details={
                'book_title': borrowing.book.title,
                'member_name': borrowing.member.full_name,
                'new_due_date': borrowing.due_date.isoformat(),
                'renewal_count': borrowing.renewal_count
            }
        )

        return borrowing
