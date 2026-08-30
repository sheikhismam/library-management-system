from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from apps.books.models import Book, Author
from apps.members.models import Member
from .models import Borrowing, Fine, Reservation
from apps.audit_logs.models import AuditLog


class CirculationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_circ",
            email="admin_circ@library.com",
            password="adminpassword"
        )
        self.author = Author.objects.create(name="Donald Knuth")
        self.book = Book.objects.create(
            isbn="978-0201896831",
            title="The Art of Computer Programming",
            total_copies=2,
            available_copies=2,
            shelf_location="Aisle 1"
        )
        self.book.authors.add(self.author)

        self.member = Member.objects.create(
            member_code="MEM-2026-TEST01",
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            phone="+1-555-0100",
            membership_status="ACTIVE",
            max_borrow_limit=2
        )

    def test_unauthorized_access(self):
        response = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_successful_checkout(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code,
            'loan_days': 14
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn('borrowing', data)
        self.assertEqual(data['borrowing']['status'], 'BORROWED')

        # Verify stock decremented atomically
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)

        # Verify audit log
        self.assertTrue(AuditLog.objects.filter(action='CHECKOUT', entity_type='Borrowing').exists())

    def test_checkout_unavailable_book(self):
        self.client.force_authenticate(user=self.admin)
        self.book.available_copies = 0
        self.book.save()

        response = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('book', response.json())

    def test_checkout_inactive_member(self):
        self.client.force_authenticate(user=self.admin)
        self.member.membership_status = 'SUSPENDED'
        self.member.save()

        response = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('member', response.json())

    def test_checkout_exceeding_borrow_limit(self):
        self.client.force_authenticate(user=self.admin)
        # Create other books
        b2 = Book.objects.create(isbn="978-0000000002", title="Book 2", total_copies=1, available_copies=1)
        b3 = Book.objects.create(isbn="978-0000000003", title="Book 3", total_copies=1, available_copies=1)

        # Borrow 2 books (max limit is 2)
        Borrowing.objects.create(book=self.book, member=self.member, status='BORROWED', due_date=timezone.now() + timedelta(days=14))
        Borrowing.objects.create(book=b2, member=self.member, status='BORROWED', due_date=timezone.now() + timedelta(days=14))

        # Attempt 3rd checkout
        response = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': b3.isbn,
            'member_identifier': self.member.member_code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('member', response.json())

    def test_duplicate_active_loan_prevention(self):
        self.client.force_authenticate(user=self.admin)
        # First checkout
        self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        }, format='json')

        # Second checkout for same book and member
        dup_res = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        }, format='json')

        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('borrowing', dup_res.json())

    def test_successful_checkin_and_stock_replenishment(self):
        self.client.force_authenticate(user=self.admin)
        # Issue book first
        checkout_res = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        }, format='json')
        borrowing_id = checkout_res.json()['borrowing']['id']

        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 1)

        # Checkin by borrowing_id
        checkin_res = self.client.post('/api/v1/circulation/checkin/', {
            'borrowing_id': borrowing_id
        }, format='json')

        self.assertEqual(checkin_res.status_code, status.HTTP_200_OK)
        data = checkin_res.json()
        self.assertEqual(data['borrowing']['status'], 'RETURNED')
        self.assertFalse(data['fine_assessed'])

        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 2)

    def test_duplicate_checkin_prevention(self):
        self.client.force_authenticate(user=self.admin)
        checkout_res = self.client.post('/api/v1/circulation/checkout/', {
            'book_identifier': self.book.isbn,
            'member_identifier': self.member.member_code
        }, format='json')
        borrowing_id = checkout_res.json()['borrowing']['id']

        # Return once
        self.client.post('/api/v1/circulation/checkin/', {'borrowing_id': borrowing_id}, format='json')

        # Return second time
        dup_res = self.client.post('/api/v1/circulation/checkin/', {'borrowing_id': borrowing_id}, format='json')
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_overdue_checkin_generates_fine(self):
        self.client.force_authenticate(user=self.admin)
        past_borrow = timezone.now() - timedelta(days=20)
        past_due = past_borrow + timedelta(days=14) # 6 days overdue

        self.book.available_copies = 1
        self.book.save()

        loan = Borrowing.objects.create(
            book=self.book,
            member=self.member,
            borrow_date=past_borrow,
            due_date=past_due,
            status='BORROWED'
        )

        checkin_res = self.client.post('/api/v1/circulation/checkin/', {
            'borrowing_id': loan.id
        }, format='json')

        self.assertEqual(checkin_res.status_code, status.HTTP_200_OK)
        data = checkin_res.json()
        self.assertTrue(data['fine_assessed'])
        self.assertIsNotNone(data['fine'])
        self.assertEqual(data['fine']['status'], 'PENDING')
        self.assertGreater(Decimal(data['fine']['amount']), Decimal('0.00'))

    def test_loan_renewal_and_max_renewals(self):
        self.client.force_authenticate(user=self.admin)
        loan = Borrowing.objects.create(
            book=self.book,
            member=self.member,
            due_date=timezone.now() + timedelta(days=5),
            status='BORROWED',
            renewal_count=0,
            max_renewals=2
        )

        # 1st Renewal
        renew1 = self.client.post(f'/api/v1/circulation/renew/{loan.id}/', {'additional_days': 14}, format='json')
        self.assertEqual(renew1.status_code, status.HTTP_200_OK)
        self.assertEqual(renew1.json()['borrowing']['renewal_count'], 1)

        # 2nd Renewal
        renew2 = self.client.post(f'/api/v1/circulation/renew/{loan.id}/', {'additional_days': 14}, format='json')
        self.assertEqual(renew2.status_code, status.HTTP_200_OK)
        self.assertEqual(renew2.json()['borrowing']['renewal_count'], 2)

        # 3rd Renewal (exceeds max_renewals=2)
        renew3 = self.client.post(f'/api/v1/circulation/renew/{loan.id}/', {'additional_days': 14}, format='json')
        self.assertEqual(renew3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('renewal_count', renew3.json())

    def test_qr_scan_action_for_book_and_member(self):
        self.client.force_authenticate(user=self.admin)

        # Scan Book QR
        book_res = self.client.post('/api/v1/circulation/qr-scan-action/', {
            'qr_payload': f'LMS:BOOK:{self.book.isbn}'
        }, format='json')
        self.assertEqual(book_res.status_code, status.HTTP_200_OK)
        self.assertEqual(book_res.json()['entity_type'], 'BOOK')
        self.assertEqual(book_res.json()['book']['title'], self.book.title)

        # Scan Member QR
        mem_res = self.client.post('/api/v1/circulation/qr-scan-action/', {
            'qr_payload': f'LMS:MEMBER:{self.member.member_code}'
        }, format='json')
        self.assertEqual(mem_res.status_code, status.HTTP_200_OK)
        self.assertEqual(mem_res.json()['entity_type'], 'MEMBER')
        self.assertEqual(mem_res.json()['member']['member_code'], self.member.member_code)

        # Invalid QR
        invalid_res = self.client.post('/api/v1/circulation/qr-scan-action/', {
            'qr_payload': 'UNKNOWN_FORMAT_QR_123'
        }, format='json')
        self.assertEqual(invalid_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_fines_list_pay_and_waive(self):
        self.client.force_authenticate(user=self.admin)
        loan = Borrowing.objects.create(
            book=self.book,
            member=self.member,
            due_date=timezone.now() - timedelta(days=5),
            status='RETURNED',
            return_date=timezone.now()
        )
        fine = Fine.objects.create(
            borrowing=loan,
            member=self.member,
            amount=Decimal('5.00'),
            status='PENDING'
        )

        # List fines
        list_res = self.client.get('/api/v1/fines/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(list_res.json()['count'], 1)

        # Pay fine
        pay_res = self.client.post(f'/api/v1/fines/{fine.id}/pay/')
        self.assertEqual(pay_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pay_res.json()['fine']['status'], 'PAID')

        # Attempt to waive already paid fine
        waive_res = self.client.post(f'/api/v1/fines/{fine.id}/waive/')
        self.assertEqual(waive_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reservation_creation_and_fulfillment(self):
        self.client.force_authenticate(user=self.admin)

        # Create Reservation
        create_res = self.client.post('/api/v1/reservations/', {
            'book_id': self.book.id,
            'member_id': self.member.id
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        res_id = create_res.json()['id']
        self.assertEqual(create_res.json()['priority'], 1)

        # Duplicate reservation prevention
        dup_res = self.client.post('/api/v1/reservations/', {
            'book_id': self.book.id,
            'member_id': self.member.id
        }, format='json')
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Fulfill reservation
        fulfill_res = self.client.post(f'/api/v1/reservations/{res_id}/fulfill/')
        self.assertEqual(fulfill_res.status_code, status.HTTP_200_OK)
        self.assertEqual(fulfill_res.json()['reservation']['status'], 'FULFILLED')
        self.assertIn('borrowing', fulfill_res.json())
