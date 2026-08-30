from rest_framework import status, permissions, viewsets, filters
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Q
from .models import Borrowing, Fine, Reservation
from .serializers import (
    BorrowingListSerializer,
    BorrowingDetailSerializer,
    CheckoutRequestSerializer,
    CheckinRequestSerializer,
    RenewRequestSerializer,
    QRScanActionSerializer,
    FineSerializer,
    ReservationSerializer
)
from .services import (
    issue_book_service,
    return_book_service,
    renew_loan_service,
    resolve_book,
    resolve_member
)
from apps.audit_logs.utils import log_activity


class CheckoutAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        borrowing = issue_book_service(
            book_identifier=data['book_identifier'],
            member_identifier=data['member_identifier'],
            loan_days=data.get('loan_days', 14),
            notes=data.get('notes', ''),
            actor=request.user,
            request=request
        )

        response_serializer = BorrowingDetailSerializer(borrowing, context={'request': request})
        return Response({
            'message': f'Book "{borrowing.book.title}" successfully issued to {borrowing.member.full_name}.',
            'borrowing': response_serializer.data
        }, status=status.HTTP_201_CREATED)


class CheckinAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckinRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        borrowing, fine = return_book_service(
            borrowing_id=data.get('borrowing_id'),
            book_identifier=data.get('book_identifier'),
            member_identifier=data.get('member_identifier'),
            notes=data.get('notes', ''),
            actor=request.user,
            request=request
        )

        response_serializer = BorrowingDetailSerializer(borrowing, context={'request': request})
        fine_data = FineSerializer(fine, context={'request': request}).data if fine else None

        return Response({
            'message': f'Book "{borrowing.book.title}" returned successfully.',
            'borrowing': response_serializer.data,
            'fine_assessed': fine is not None,
            'fine': fine_data
        }, status=status.HTTP_200_OK)


class RenewAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        serializer = RenewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        borrowing = renew_loan_service(
            borrowing_id=pk,
            additional_days=data.get('additional_days', 14),
            notes=data.get('notes', ''),
            actor=request.user,
            request=request
        )

        response_serializer = BorrowingDetailSerializer(borrowing, context={'request': request})
        return Response({
            'message': f'Loan for "{borrowing.book.title}" renewed until {borrowing.due_date.strftime("%Y-%m-%d")}.',
            'borrowing': response_serializer.data
        }, status=status.HTTP_200_OK)


class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['book__title', 'book__isbn', 'member__first_name', 'member__last_name', 'member__member_code']
    ordering_fields = ['borrow_date', 'due_date', 'return_date', 'status']
    ordering = ['-borrow_date']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BorrowingDetailSerializer
        return BorrowingListSerializer

    def get_queryset(self):
        qs = Borrowing.objects.select_related('book', 'member').prefetch_related('fines').all()
        params = self.request.query_params

        # Filter by status
        loan_status = params.get('status')
        if loan_status:
            qs = qs.filter(status=loan_status.upper())

        # Filter by overdue
        is_overdue = params.get('is_overdue')
        if is_overdue is not None:
            if is_overdue.lower() in ('true', '1'):
                qs = qs.filter(status__in=['BORROWED', 'OVERDUE'], due_date__lt=timezone.now())
            elif is_overdue.lower() in ('false', '0'):
                qs = qs.filter(Q(status='RETURNED') | Q(due_date__gte=timezone.now()))

        # Filter by member ID or code
        member = params.get('member')
        if member:
            if member.isdigit():
                qs = qs.filter(member__id=int(member))
            else:
                qs = qs.filter(member__member_code__iexact=member)

        # Filter by book ID or ISBN
        book = params.get('book')
        if book:
            if book.isdigit():
                qs = qs.filter(book__id=int(book))
            else:
                qs = qs.filter(book__isbn__iexact=book)

        return qs

    @action(detail=False, methods=['get'], url_path='overdue')
    def overdue_loans(self, request):
        """
        List all currently active loans that have exceeded their due date.
        """
        overdue_qs = Borrowing.objects.select_related('book', 'member').filter(
            status__in=['BORROWED', 'OVERDUE'],
            due_date__lt=timezone.now()
        ).order_by('due_date')

        page = self.paginate_queryset(overdue_qs)
        if page is not None:
            serializer = BorrowingListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = BorrowingListSerializer(overdue_qs, many=True, context={'request': request})
        return Response(serializer.data)


class QRScanActionAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = QRScanActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_payload = serializer.validated_data['qr_payload'].strip()

        # 1. Check if Book payload
        if raw_payload.startswith('LMS:BOOK:') or raw_payload.startswith('BOOK:'):
            book = resolve_book(raw_payload)
            active_loans = Borrowing.objects.filter(book=book, status__in=['BORROWED', 'OVERDUE']).select_related('member')
            loans_data = [
                {
                    'borrowing_id': l.id,
                    'member_name': l.member.full_name,
                    'member_code': l.member.member_code,
                    'borrow_date': l.borrow_date,
                    'due_date': l.due_date,
                    'is_overdue': l.is_overdue,
                    'overdue_days': l.overdue_days
                }
                for l in active_loans
            ]

            return Response({
                'entity_type': 'BOOK',
                'raw_payload': raw_payload,
                'book': {
                    'id': book.id,
                    'isbn': book.isbn,
                    'title': book.title,
                    'available_copies': book.available_copies,
                    'total_copies': book.total_copies,
                    'is_available': book.is_available,
                    'shelf_location': book.shelf_location,
                    'cover_image': book.cover_image.url if book.cover_image else None,
                },
                'active_loans_count': len(loans_data),
                'active_loans': loans_data,
                'recommended_action': 'CHECKIN' if len(loans_data) > 0 and book.available_copies == 0 else ('CHECKOUT' if book.is_available else 'VIEW')
            }, status=status.HTTP_200_OK)

        # 2. Check if Member payload
        elif raw_payload.startswith('LMS:MEMBER:') or raw_payload.startswith('MEMBER:'):
            member = resolve_member(raw_payload)
            active_loans = Borrowing.objects.filter(member=member, status__in=['BORROWED', 'OVERDUE']).select_related('book')
            loans_data = [
                {
                    'borrowing_id': l.id,
                    'book_title': l.book.title,
                    'book_isbn': l.book.isbn,
                    'borrow_date': l.borrow_date,
                    'due_date': l.due_date,
                    'is_overdue': l.is_overdue,
                    'overdue_days': l.overdue_days
                }
                for l in active_loans
            ]

            return Response({
                'entity_type': 'MEMBER',
                'raw_payload': raw_payload,
                'member': {
                    'id': member.id,
                    'member_code': member.member_code,
                    'full_name': member.full_name,
                    'email': member.email,
                    'phone': member.phone,
                    'membership_status': member.membership_status,
                    'can_borrow': member.can_borrow,
                    'max_borrow_limit': member.max_borrow_limit,
                    'active_loans_count': len(loans_data),
                },
                'active_loans': loans_data,
                'recommended_action': 'SCAN_BOOK_FOR_CHECKOUT' if member.can_borrow else 'VIEW_PROFILE'
            }, status=status.HTTP_200_OK)

        # 3. Invalid or unrecognized format
        return Response({
            'error': f'Unrecognized QR format: "{raw_payload}". Expected "LMS:BOOK:<ISBN>" or "LMS:MEMBER:<CODE>".'
        }, status=status.HTTP_400_BAD_REQUEST)


class FineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Fine.objects.select_related('borrowing__book', 'member').all()
    serializer_class = FineSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['member__first_name', 'member__last_name', 'member__member_code', 'reason', 'borrowing__book__title']
    ordering_fields = ['amount', 'created_at', 'status', 'paid_date']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        member_param = self.request.query_params.get('member')
        if member_param:
            if member_param.isdigit():
                qs = qs.filter(member__id=int(member_param))
            else:
                qs = qs.filter(member__member_code__iexact=member_param)
        return qs

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        fine = self.get_object()
        if fine.status == 'PAID':
            return Response({'error': 'This fine has already been paid.'}, status=status.HTTP_400_BAD_REQUEST)
        if fine.status == 'WAIVED':
            return Response({'error': 'Cannot pay a fine that has already been waived.'}, status=status.HTTP_400_BAD_REQUEST)

        fine.mark_as_paid()

        log_activity(
            request=request,
            action='PAY_FINE',
            entity_type='Fine',
            entity_id=fine.id,
            details={
                'amount': str(fine.amount),
                'member_name': fine.member.full_name,
                'member_code': fine.member.member_code
            }
        )

        return Response({
            'message': f'Fine of ${fine.amount:.2f} marked as PAID for {fine.member.full_name}.',
            'fine': FineSerializer(fine, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def waive(self, request, pk=None):
        fine = self.get_object()
        if fine.status == 'PAID':
            return Response({'error': 'Cannot waive a fine that has already been paid.'}, status=status.HTTP_400_BAD_REQUEST)
        if fine.status == 'WAIVED':
            return Response({'error': 'This fine has already been waived.'}, status=status.HTTP_400_BAD_REQUEST)

        fine.mark_as_waived()

        log_activity(
            request=request,
            action='WAIVE_FINE',
            entity_type='Fine',
            entity_id=fine.id,
            details={
                'amount': str(fine.amount),
                'member_name': fine.member.full_name,
                'member_code': fine.member.member_code
            }
        )

        return Response({
            'message': f'Fine of ${fine.amount:.2f} waived for {fine.member.full_name}.',
            'fine': FineSerializer(fine, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.select_related('book', 'member').all()
    serializer_class = ReservationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['book__title', 'book__isbn', 'member__first_name', 'member__last_name', 'member__member_code']
    ordering_fields = ['priority', 'reservation_date', 'status']
    ordering = ['priority', 'reservation_date']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        book_param = self.request.query_params.get('book')
        if book_param:
            qs = qs.filter(book__id=book_param)
        member_param = self.request.query_params.get('member')
        if member_param:
            qs = qs.filter(member__id=member_param)
        return qs

    def perform_create(self, serializer):
        book = serializer.validated_data['book']
        member = serializer.validated_data['member']

        # Enforce duplicate active reservation prevention
        existing = Reservation.objects.filter(
            book=book, member=member, status='PENDING'
        ).exists()
        if existing:
            raise ValidationError({'reservation': f'Member {member.full_name} already has an active pending reservation for "{book.title}".'})

        # Determine FIFO priority
        highest_priority = Reservation.objects.filter(book=book, status='PENDING').order_by('-priority').first()
        priority = (highest_priority.priority + 1) if highest_priority else 1

        reservation = serializer.save(priority=priority, status='PENDING')

        log_activity(
            request=self.request,
            action='RESERVATION',
            entity_type='Reservation',
            entity_id=reservation.id,
            details={
                'event': 'Reservation Created',
                'book_title': book.title,
                'member_name': member.full_name,
                'priority': priority
            }
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != 'PENDING':
            return Response({'error': f'Cannot cancel reservation with status: {reservation.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        reservation.status = 'CANCELLED'
        reservation.save(update_fields=['status'])

        log_activity(
            request=request,
            action='RESERVATION',
            entity_type='Reservation',
            entity_id=reservation.id,
            details={
                'event': 'Reservation Cancelled',
                'book_title': reservation.book.title,
                'member_name': reservation.member.full_name
            }
        )

        return Response({
            'message': f'Reservation for "{reservation.book.title}" has been cancelled.',
            'reservation': ReservationSerializer(reservation, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def fulfill(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != 'PENDING':
            return Response({'error': f'Cannot fulfill reservation with status: {reservation.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        # Issue the book to the reserving member
        borrowing = issue_book_service(
            book_identifier=str(reservation.book.id),
            member_identifier=str(reservation.member.id),
            loan_days=14,
            notes='Issued via Reservation Fulfillment',
            actor=request.user,
            request=request
        )

        reservation.status = 'FULFILLED'
        reservation.save(update_fields=['status'])

        log_activity(
            request=request,
            action='RESERVATION',
            entity_type='Reservation',
            entity_id=reservation.id,
            details={
                'event': 'Reservation Fulfilled',
                'book_title': reservation.book.title,
                'member_name': reservation.member.full_name,
                'borrowing_id': borrowing.id
            }
        )

        return Response({
            'message': f'Reservation fulfilled! Book "{reservation.book.title}" issued to {reservation.member.full_name}.',
            'reservation': ReservationSerializer(reservation, context={'request': request}).data,
            'borrowing': BorrowingDetailSerializer(borrowing, context={'request': request}).data
        }, status=status.HTTP_200_OK)
