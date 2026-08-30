from decimal import Decimal
from datetime import timedelta
from zoneinfo import ZoneInfo
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from apps.books.models import Book, Author
from apps.members.models import Member
from apps.circulation.models import Borrowing, Fine, Reservation
from apps.reviews.models import Review


class ReportPDFAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username="admin_reports",
            email="admin_reports@library.com",
            password="adminpassword"
        )

        self.author = Author.objects.create(name="Report Author")
        self.book = Book.objects.create(
            isbn="978-1100000001",
            title="Reporting Fundamentals",
            publisher="Report Press",
            total_copies=2,
            available_copies=2,
            shelf_location="Aisle 2"
        )
        self.book.authors.add(self.author)

        self.member = Member.objects.create(
            member_code="MEM-2026-RP01",
            first_name="Report",
            last_name="Tester",
            email="report.tester@example.com",
            phone="+1-555-0121",
            membership_status="ACTIVE",
            max_borrow_limit=5
        )

    def _assert_valid_pdf(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment', response.get('Content-Disposition', ''))
        self.assertTrue(
            response.content.startswith(b'%PDF'),
            "Response body does not start with PDF magic bytes"
        )
        self.assertTrue(
            b'%%EOF' in response.content,
            "Response body is missing the PDF end-of-file trailer"
        )

    def test_report_endpoints_require_authentication(self):
        for url in [
            '/api/v1/reports/inventory/',
            '/api/v1/reports/overdue/',
            f'/api/v1/reports/member/{self.member.id}/',
            '/api/v1/reports/guide/content/',
            '/api/v1/reports/guide/pdf/?lang=en',
        ]:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"{url} should require authentication"
            )

    def test_inventory_report_pdf(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/reports/inventory/')
        self._assert_valid_pdf(response)

    def test_overdue_report_pdf(self):
        self.client.force_authenticate(user=self.user)

        overdue = Borrowing.objects.create(
            book=self.book,
            member=self.member,
            due_date=timezone.now() - timedelta(days=6),
            status='BORROWED'
        )
        Fine.objects.create(
            borrowing=overdue,
            member=self.member,
            amount=Decimal('6.00'),
            status='PENDING'
        )

        response = self.client.get('/api/v1/reports/overdue/')
        self._assert_valid_pdf(response)

    def test_member_report_pdf(self):
        self.client.force_authenticate(user=self.user)

        returned = Borrowing.objects.create(
            book=self.book,
            member=self.member,
            borrow_date=timezone.now() - timedelta(days=30),
            due_date=timezone.now() - timedelta(days=16),
            return_date=timezone.now() - timedelta(days=2),
            status='RETURNED'
        )
        Fine.objects.create(
            borrowing=returned,
            member=self.member,
            amount=Decimal('5.00'),
            status='PENDING'
        )
        Reservation.objects.create(
            book=self.book,
            member=self.member,
            status='PENDING',
            priority=1
        )
        Review.objects.create(
            book=self.book,
            member=self.member,
            reviewer_name=self.member.full_name,
            rating=5,
            comment="A solid reference for reporting workflows."
        )

        response = self.client.get(f'/api/v1/reports/member/{self.member.id}/')
        self._assert_valid_pdf(response)

    def test_member_report_not_found(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/reports/member/999999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inventory_report_reflects_current_data_and_timestamp(self):
        self.client.force_authenticate(user=self.user)

        extra = Book.objects.create(
            isbn="978-1100000099",
            title="Freshly Added Current Book",
            publisher="Current Press",
            total_copies=1,
            available_copies=1,
        )

        response = self.client.get('/api/v1/reports/inventory/')
        self._assert_valid_pdf(response)

        # Generated from the current DB state at request time.
        self.assertIn(b"Freshly Added Current Book", response.content)
        # Header carries the date in Bangladesh local time (Asia/Dhaka).
        today = timezone.now().astimezone(ZoneInfo("Asia/Dhaka")).strftime('%Y-%m-%d')
        self.assertIn(today.encode(), response.content)

    def test_report_timestamp_is_in_bangladesh_time(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/reports/inventory/')
        self._assert_valid_pdf(response)

        text = response.content.decode('latin-1')
        marker = 'Generated: '
        self.assertIn(marker, text)

        # Expected timestamp computed explicitly for Asia/Dhaka (UTC+6),
        # independent of the configured/active Django timezone (UTC).
        now_dhaka = timezone.now().astimezone(ZoneInfo("Asia/Dhaka"))
        expected = 'Generated: ' + now_dhaka.strftime('%Y-%m-%d %H:%M:%S %Z')
        # ReportLab's %Z yields the UTC offset abbreviation, e.g. '+06'.
        self.assertIn(expected, text)

    def test_overdue_report_reflects_current_data_and_timestamp(self):
        self.client.force_authenticate(user=self.user)
        self.client.get('/api/v1/reports/overdue/')

        # First request with no overdue loans, then create one and re-request.
        Borrowing.objects.create(
            book=self.book,
            member=self.member,
            due_date=timezone.now() - timedelta(days=2),
            status='OVERDUE',
        )

        response = self.client.get('/api/v1/reports/overdue/')
        self._assert_valid_pdf(response)
        self.assertIn(self.book.title.encode(), response.content)
        self.assertIn(self.member.full_name.encode(), response.content)

    def test_guide_content_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/reports/guide/content/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn('en', data)
        self.assertIn('bn', data)
        self.assertEqual(len(data['en']), 12)
        self.assertEqual(len(data['bn']), 12)
        for lang in ('en', 'bn'):
            for section in data[lang]:
                self.assertIn('key', section)
                self.assertIn('title', section)
                self.assertIn('paragraphs', section)
                self.assertTrue(section['title'])
                self.assertTrue(section['paragraphs'])
        self.assertEqual(
            [s['key'] for s in data['en']],
            [s['key'] for s in data['bn']],
        )

    def test_guide_pdf_english(self):
        self.client.force_authenticate(user=self.user)
        # The guide PDF is English-only; even a Bengali lang request still
        # returns the English Admin Guide PDF (no Bengali guide PDF exists).
        for url in (
            '/api/v1/reports/guide/pdf/?lang=en',
            '/api/v1/reports/guide/pdf/?lang=bn',
        ):
            response = self.client.get(url)
            self._assert_valid_pdf(response)
            self.assertIn('admin_guide_en', response['Content-Disposition'])

    def test_guide_pdf_defaults_to_english(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/reports/guide/pdf/')
        self._assert_valid_pdf(response)
        self.assertIn('admin_guide_en', response['Content-Disposition'])