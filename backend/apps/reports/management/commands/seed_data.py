import datetime
import random
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.books.models import Book, Author, Category
from apps.members.models import Member
from apps.circulation.models import Borrowing, Fine, Reservation
from apps.reviews.models import Review


User = get_user_model()


@transaction.atomic
def seed_command():
    """Seed the library database with realistic test data. Idempotent - safe to run multiple times."""

    # 1. Superuser
    user, created = User.objects.get_or_create(
        username="admin",
        defaults={"email": "admin@library.local"},
    )
    if created:
        user.set_password("admin123")
        user.is_staff = True
        user.is_superuser = True
        user.save()
    else:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])

    # 2. Categories
    category_names = [
        "Fiction", "Non-Fiction", "Science Fiction", "Mystery",
        "Fantasy", "Biography", "History", "Children's",
    ]
    categories = {}
    for name in category_names:
        c, _ = Category.objects.get_or_create(name=name)
        categories[name] = c

    # 3. Authors
    author_names = [
        "Jane Austen", "George Orwell", "Agatha Christie",
        "J.R.R. Tolkien", "Mary Shelley", "Mark Twain",
        "Isaac Asimov", "Umberto Eco", "Charles Dickens",
    ]
    authors = {}
    for name in author_names:
        a, _ = Author.objects.get_or_create(name=name)
        authors[name] = a

    # 4. Books
    books_data = [
        {
            "isbn": "9780141182834",
            "title": "Pride and Prejudice",
            "author_names": ["Jane Austen"],
            "category_names": ["Fiction"],
            "publisher": "Penguin Classics",
            "publication_year": 1813,
            "total_copies": 15,
            "available_copies": 12,
            "shelf_location": "A-01",
        },
        {
            "isbn": "9780451524935",
            "title": "1984",
            "author_names": ["George Orwell"],
            "category_names": ["Science Fiction", "Dystopian"],
            "publisher": "Signet Classics",
            "publication_year": 1949,
            "total_copies": 20,
            "available_copies": 18,
            "shelf_location": "B-12",
        },
        {
            "isbn": "9780061120084",
            "title": "The Hobbit",
            "author_names": ["J.R.R. Tolkien"],
            "category_names": ["Fantasy", "Adventure"],
            "publisher": "Houghton Mifflin",
            "publication_year": 1937,
            "total_copies": 12,
            "available_copies": 9,
            "shelf_location": "C-05",
        },
        {
            "isbn": "9780062073453",
            "title": "And Then There Were None",
            "author_names": ["Agatha Christie"],
            "category_names": ["Mystery", "Crime"],
            "publisher": "HarperCollins",
            "publication_year": 1939,
            "total_copies": 10,
            "available_copies": 8,
            "shelf_location": "D-02",
        },
        {
            "isbn": "9780553296983",
            "title": "I, Robot",
            "author_names": ["Isaac Asimov"],
            "category_names": ["Science Fiction"],
            "publisher": "Bantam Spectra",
            "publication_year": 1950,
            "total_copies": 18,
            "available_copies": 15,
            "shelf_location": "E-08",
        },
        {
            "isbn": "9780140449136",
            "title": "Frankenstein",
            "author_names": ["Mary Shelley"],
            "category_names": ["Fiction", "Horror"],
            "publisher": "Penguin Classics",
            "publication_year": 1818,
            "total_copies": 14,
            "available_copies": 11,
            "shelf_location": "F-11",
        },
        {
            "isbn": "9780141187900",
            "title": "Tom Sawyer",
            "author_names": ["Mark Twain"],
            "category_names": ["Fiction", "Adventure"],
            "publisher": "Penguin Classics",
            "publication_year": 1876,
            "total_copies": 16,
            "available_copies": 13,
            "shelf_location": "A-03",
        },
        {
            "isbn": "9780143125057",
            "title": "A Tale of Two Cities",
            "author_names": ["Charles Dickens"],
            "category_names": ["Historical Fiction"],
            "publisher": "Penguin Classics",
            "publication_year": 1859,
            "total_copies": 13,
            "available_copies": 10,
            "shelf_location": "B-07",
        },
        {
            "isbn": "9780374528382",
            "title": "The Name of the Rose",
            "author_names": ["Umberto Eco"],
            "category_names": ["Historical Fiction", "Mystery"],
            "publisher": "Mariner Books",
            "publication_year": 1980,
            "total_copies": 11,
            "available_copies": 8,
            "shelf_location": "C-03",
        },
        {
            "isbn": "9780140449565",
            "title": "The Little Prince",
            "author_names": ["Antoine de Saint-Exupéry"],
            "category_names": ["Children's", "Fable"],
            "publisher": "Harvest Books",
            "publication_year": 1943,
            "total_copies": 20,
            "available_copies": 19,
            "shelf_location": "D-01",
        },
    ]

    books = []
    for bd in books_data:
        author_objs = [authors[name] for name in bd["author_names"] if name in authors]
        category_objs = [categories[name] for name in bd["category_names"] if name in categories]

        book_kwargs = {
            "isbn": bd["isbn"],
            "title": bd["title"],
            "subtitle": "",
            "publisher": bd["publisher"],
            "publication_year": bd["publication_year"],
            "total_copies": bd["total_copies"],
            "available_copies": bd["available_copies"],
            "shelf_location": bd["shelf_location"],
        }
        book, book_created = Book.objects.get_or_create(isbn=bd["isbn"], defaults=book_kwargs)
        if book_created:
            book.authors.set(author_objs)
            book.categories.set(category_objs)
        else:
            book.authors.set(author_objs)
            book.categories.set(category_objs)
        books.append(book)

    # 5. Members - using stable emails as lookup keys
    member_emails = [
        "john.smith@library.local",
        "mary.johnson@library.local",
        "robert.williams@library.local",
        "lisa.brown@library.local",
        "david.davis@library.local",
        "sarah.miller@library.local",
        "michael.wilson@library.local",
        "emma.moore@library.local",
    ]
    members = []
    year = 2026  # Fixed year for deterministic member_code

    for idx, email in enumerate(member_emails):
        dots = email.index(".")
        at = email.index("@")
        first = email[:dots].capitalize()
        last = email[dots+1:at].capitalize()

        member_code = f"MEM-{year}-{idx + 100:03d}"  # 100-107, deterministic

        m, created = Member.objects.get_or_create(
            email=email,
            defaults={
                "member_code": member_code,
                "first_name": first,
                "last_name": last,
                "email": email,
                "phone": f"555-0{idx+1:04d}",
                "membership_status": "ACTIVE",
                "max_borrow_limit": 5,
            },
        )
        # On re-runs, ensure member_code is correct (idempotency)
        if not created and m.member_code != member_code:
            m.member_code = member_code
            m.save(update_fields=["member_code"])
        members.append(m)

    # Fixed reference date for all borrowing data (doesn't change between runs)
    _SEED_DATE = datetime.datetime(2026, 8, 1)

# 6. Borrowing records with timezone-aware datetimes
    def create_borrowing(book, member, status, borrow_offset=0, return_offset=0, overdue_days=0):
        """Create a borrowing with proper timezone-aware datetimes.
        Uses fixed _SEED_DATE for idempotency - same result every run."""
        base_time = timezone.make_aware(
            datetime.datetime(_SEED_DATE.year, _SEED_DATE.month, _SEED_DATE.day)
            - datetime.timedelta(days=90 - borrow_offset)
        )
        borrow_date = base_time
        due_date = base_time + datetime.timedelta(days=14)
        # Ensure due_date is timezone-aware
        if timezone.is_naive(due_date):
            due_date = timezone.make_aware(due_date)

        if status == "OVERDUE":
            # due_date is in the past
            due_date = timezone.make_aware(
                _SEED_DATE - datetime.timedelta(days=overdue_days - 14)
            )
            return_date = None
        elif status == "RETURNED":
            return_date = base_time + datetime.timedelta(days=14 + return_offset)
            # Ensure return_date is timezone-aware
            if timezone.is_naive(return_date):
                return_date = timezone.make_aware(return_date)
        else:  # BORROWED
            return_date = None

        borrowing_defaults = {
            "book": book,
            "member": member,
            "borrow_date": borrow_date,
            "due_date": due_date,
            "status": status,
            "renewal_count": random.randint(0, 2),
        }

        if return_date is not None:
            borrowing_defaults["return_date"] = return_date

        # Use book + member + status + borrow_date as lookup key
        # All are fixed, so this is idempotent
        b, created = Borrowing.objects.get_or_create(
            book=book,
            member=member,
            status=status,
            borrow_date=borrow_date,
            defaults=borrowing_defaults,
        )
        if not created:
            # Update existing record with current defaults
            for k, v in borrowing_defaults.items():
                setattr(b, k, v)
            b.save(update_fields=list(borrowing_defaults.keys()))
        return b

    borrowings = []

    # Active BORROWED loans
    for i in range(3):
        b = create_borrowing(books[i], members[i], "BORROWED", borrow_offset=i)
        borrowings.append(b)

    # RETURNED on time (return_date slightly before due_date)
    for i in range(2):
        b = create_borrowing(books[3+i], members[3+i], "RETURNED", return_offset=-i)
        borrowings.append(b)

    # RETURNED late (return_date after due_date)
    for i in range(2):
        b = create_borrowing(books[5+i], members[5+i], "RETURNED", return_offset=7+i*3)
        borrowings.append(b)

    # Active OVERDUE (due_date in the past, status=OVERDUE)
    for i in range(2):
        b = create_borrowing(books[i], members[3+i], "OVERDUE", overdue_days=14+i*7)
        borrowings.append(b)

    # 7. Fines for late/overdue borrowings only
    fine_records = []
    for b in borrowings:
        if b.status in ("RETURNED", "OVERDUE") and b.overdue_days > 0:
            fine_amount = b.calculate_fine_amount(daily_rate=Decimal("1.00"))

            f, created = Fine.objects.get_or_create(
                borrowing=b,
                defaults={
                    "member": b.member,
                    "amount": fine_amount,
                    "status": "PENDING",
                    "daily_rate": Decimal("1.00"),
                    "reason": "Overdue book return",
                },
            )
            if created or f.status == "PENDING":
                fine_records.append(f)

    # 8. Reservations
    reservation_data = [
        {"book": books[0], "member": members[0], "status": "PENDING"},
        {"book": books[1], "member": members[1], "status": "FULFILLED"},
        {"book": books[2], "member": members[2], "status": "CANCELLED"},
    ]

    reservations = []
    for rd in reservation_data:
        book = rd["book"]
        member = rd["member"]
        status = rd["status"]

        r, created = Reservation.objects.get_or_create(
            book=book,
            member=member,
            defaults={"status": status, "priority": random.randint(1, 5)},
        )
        reservations.append(r)

    # 9. Reviews
    review_data = [
        {"book": books[0], "member": members[0], "rating": 5, "comment": "A wonderful classic, beautifully written."},
        {"book": books[1], "member": members[1], "rating": 4, "comment": "Thought-provoking and eerily relevant today."},
        {"book": books[2], "member": members[2], "rating": 5, "comment": "Fantasy at its finest, a must-read for any fan."},
        {"book": books[3], "member": members[3], "rating": 3, "comment": "A solid mystery, but the ending felt rushed."},
        {"book": books[4], "member": members[4], "rating": 2, "comment": "Too short and lacked depth in character development."},
        {"book": books[5], "member": members[5], "rating": 5, "comment": "Powerful and tragic, Shelley's masterpiece."},
        {"book": books[6], "member": members[6], "rating": 4, "comment": "Classic adventure, perfect for a relaxed reading weekend."},
        {"book": books[7], "member": members[7], "rating": 3, "comment": "Good historical perspective, but the prose is dense."},
    ]

    reviews = []
    for rd in review_data:
        book = rd["book"]
        member = rd["member"]
        r, created = Review.objects.get_or_create(
            book=book,
            member=member,
            rating=rd["rating"],
            defaults={
                "reviewer_name": member.full_name,
                "comment": rd["comment"],
                "is_approved": True,
            },
        )
        reviews.append(r)

    # 10. Summary
    print(f"""
Seed complete:
  Users: 1 (admin superuser)
  Categories: {Category.objects.count()}
  Authors: {Author.objects.count()}
  Books: {Book.objects.count()}
  Members: {Member.objects.count()}
  Borrowings: {Borrowing.objects.count()}
  Fines: {Fine.objects.count()}
  Reservations: {Reservation.objects.count()}
  Reviews: {Review.objects.count()}
""")


class Command(BaseCommand):
    help = "Seed the library database with realistic test data. Idempotent - safe to run multiple times."

    def handle(self, *args, **options):
        seed_command()