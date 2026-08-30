from decimal import Decimal
from datetime import timedelta
from datetime import datetime
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from apps.books.models import Book, Author, Category
from apps.members.models import Member
from apps.circulation.models import Borrowing, Fine


class AnalyticsDashboardAPITests(TestCase):
    API_URL = '/api/v1/analytics/dashboard/'

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username="admin_analytics",
            email="admin_analytics@library.com",
            password="adminpassword"
        )

        self.author = Author.objects.create(name="Analytics Author")
        self.category_taken = Category.objects.create(name="Data Science")
        self.category_rare = Category.objects.create(name="Rare Books")
        self.category_sub = Category.objects.create(
            name="Machine Learning", parent=self.category_taken
        )

        self.book_taken = Book.objects.create(
            isbn="978-1000000001",
            title="Analytics Top Book",
            publisher="Analytics Press",
            total_copies=3,
            available_copies=3,
            shelf_location="Aisle 9"
        )
        self.book_taken.authors.add(self.author)
        self.book_taken.categories.add(self.category_taken)

        self.book_rare = Book.objects.create(
            isbn="978-1000000002",
            title="Analytics Rare Book",
            total_copies=1,
            available_copies=1
        )
        self.book_rare.categories.add(self.category_rare)

        self.member = Member.objects.create(
            member_code="MEM-2026-AN01",
            first_name="Analytics",
            last_name="Tester",
            email="analytics.tester@example.com",
            phone="+1-555-0107",
            membership_status="ACTIVE",
            max_borrow_limit=5
        )

    def _create_borrowing(self, book, member, status_val='BORROWED', **kwargs):
        return Borrowing.objects.create(
            book=book,
            member=member,
            status=status_val,
            **kwargs
        )

    def test_dashboard_requires_authentication(self):
        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_summary_statistics(self):
        self.client.force_authenticate(user=self.user)

        # Active (future due date) and overdue (past due date) loans
        self._create_borrowing(
            self.book_taken, self.member,
            due_date=timezone.now() + timedelta(days=10)
        )
        self._create_borrowing(
            self.book_rare, self.member,
            due_date=timezone.now() - timedelta(days=5)
        )
        # Returned loans do not count as active
        self._create_borrowing(
            self.book_taken, self.member, status_val='RETURNED',
            due_date=timezone.now() + timedelta(days=10),
            return_date=timezone.now()
        )

        Fine.objects.create(
            borrowing=Borrowing.objects.filter(status='RETURNED').first(),
            member=self.member,
            amount=Decimal('12.50'),
            status='PAID'
        )
        overdue_borrowing = Borrowing.objects.filter(
            status='BORROWED', due_date__lt=timezone.now()
        ).first()
        Fine.objects.create(
            borrowing=overdue_borrowing,
            member=self.member,
            amount=Decimal('7.25'),
            status='PENDING'
        )

        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        summary = data['summary']
        self.assertEqual(summary['total_books'], 2)
        self.assertEqual(summary['total_copies'], 4)
        self.assertEqual(summary['active_loans'], 2)
        self.assertEqual(summary['overdue_loans'], 1)
        self.assertEqual(summary['total_members'], 1)
        self.assertEqual(summary['total_authors'], 1)
        self.assertEqual(summary['total_publishers'], 1)
        self.assertEqual(summary['total_genres'], 3)
        self.assertEqual(summary['total_sub_genres'], 1)
        self.assertEqual(summary['fines_collected'], '12.50')
        self.assertEqual(summary['fines_pending'], '7.25')

    def test_dashboard_publishers_are_distinct_and_empty_skipped(self):
        self.client.force_authenticate(user=self.user)

        # A third book with the same publisher as book_taken must not inflate
        # the publisher count; a book with an empty publisher is ignored.
        Book.objects.create(
            isbn="978-1000000003",
            title="Analytics Companion",
            publisher="Analytics Press",
            total_copies=1,
            available_copies=1
        )
        Book.objects.create(
            isbn="978-1000000004",
            title="Analytics Orphan",
            publisher="",
            total_copies=1,
            available_copies=1
        )

        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        summary = response.json()['summary']
        self.assertEqual(summary['total_books'], 4)
        self.assertEqual(summary['total_authors'], 1)
        self.assertEqual(summary['total_publishers'], 1)
        self.assertEqual(summary['total_genres'], 3)
        self.assertEqual(summary['total_sub_genres'], 1)

    def test_dashboard_genre_and_sub_genre_distinction(self):
        self.client.force_authenticate(user=self.user)

        # A category WITHOUT a parent is a Genre.
        Category.objects.create(name="History")
        # A category WITH a parent is a Sub-genre.
        Category.objects.create(name="European History", parent=self.category_rare)

        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        summary = response.json()['summary']

        # total_genres counts ALL Category rows (including sub-genres), per the
        # existing unchangeable calculation: 3 in setUp + History + European History.
        self.assertEqual(summary['total_genres'], 5)
        # 1 in setUp + European History = 2 sub-genres (categories with a parent).
        self.assertEqual(summary['total_sub_genres'], 2)

    def test_dashboard_borrowing_timeline(self):
        self.client.force_authenticate(user=self.user)

        self._create_borrowing(
            self.book_taken, self.member,
            due_date=timezone.now() + timedelta(days=14)
        )
        self._create_borrowing(
            self.book_rare, self.member,
            due_date=timezone.now() + timedelta(days=14)
        )

        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        timeline = response.json()['borrowing_activity']['timeline']
        self.assertEqual(len(timeline), 12)
        for point in timeline:
            self.assertIn('month', point)
            self.assertIn('count', point)
            self.assertGreaterEqual(point['count'], 0)

        # Chronological ascending order (oldest month first)
        parsed = [
            datetime.strptime(point['month'], '%b %Y')
            for point in timeline
        ]
        self.assertEqual(parsed, sorted(parsed))

        # The current month bucket includes our two recent borrowings
        latest_count = timeline[-1]['count']
        self.assertGreaterEqual(latest_count, 2)

    def test_dashboard_popular_books_and_categories(self):
        self.client.force_authenticate(user=self.user)

        now = timezone.now()
        self._create_borrowing(
            self.book_taken, self.member, due_date=now + timedelta(days=14)
        )
        self._create_borrowing(
            self.book_taken, self.member, due_date=now + timedelta(days=14)
        )
        self._create_borrowing(
            self.book_taken, self.member, due_date=now + timedelta(days=14)
        )
        self._create_borrowing(
            self.book_rare, self.member, due_date=now + timedelta(days=14)
        )

        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()

        popular_books = data['popular_books']
        self.assertLessEqual(len(popular_books), 5)
        top_book = popular_books[0]
        self.assertEqual(top_book['id'], self.book_taken.id)
        self.assertEqual(top_book['title'], self.book_taken.title)
        self.assertEqual(top_book['isbn'], self.book_taken.isbn)
        self.assertEqual(top_book['borrow_count'], 3)

        popular_categories = data['popular_categories']
        self.assertLessEqual(len(popular_categories), 5)
        top_category = popular_categories[0]
        self.assertEqual(top_category['name'], 'Data Science')
        self.assertEqual(top_category['borrow_count'], 3)

    def test_dashboard_recent_activity_feed(self):
        self.client.force_authenticate(user=self.user)

        now = timezone.now()
        recent1 = self._create_borrowing(
            self.book_taken, self.member,
            due_date=now + timedelta(days=14)
        )
        recent2 = self._create_borrowing(
            self.book_rare, self.member,
            due_date=now + timedelta(days=14)
        )

        response = self.client.get(self.API_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        activity = response.json()['recent_activity']
        self.assertLessEqual(len(activity), 10)
        # Newest first
        self.assertEqual(activity[0]['id'], recent2.id)
        self.assertEqual(activity[0]['book_title'], self.book_rare.title)
        self.assertEqual(activity[1]['id'], recent1.id)
        self.assertEqual(activity[1]['book_title'], self.book_taken.title)
        for entry in activity:
            self.assertIn('action', entry)
            self.assertIn('book_title', entry)
            self.assertIn('member_name', entry)
            self.assertIn('borrow_date', entry)
            self.assertIn('due_date', entry)
        self.assertEqual(activity[0]['member_name'], self.member.full_name)