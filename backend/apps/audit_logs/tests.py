from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from .models import AuditLog
from .serializers import audit_summary


class AuditLogModelTests(TestCase):
    def test_audit_log_creation(self):
        user = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="secretpassword"
        )
        log = AuditLog.objects.create(
            user=user,
            action="CREATE",
            entity_type="Book",
            entity_id="978-0201616224",
            details={"title": "The Pragmatic Programmer", "copies": 3},
            ip_address="127.0.0.1"
        )
        self.assertEqual(log.action, "CREATE")
        self.assertEqual(log.user.username, "admin_user")
        self.assertEqual(log.details["copies"], 3)


_user_counter = 0


def _make_log(action, entity_type, entity_id="E1", details=None):
    global _user_counter
    _user_counter += 1
    user = User.objects.create_user(
        username="admin_%s_%d" % (entity_id, _user_counter),
        email="admin@example.com",
        password="secretpassword"
    )
    return AuditLog.objects.create(
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
    )


class AuditSummaryTests(TestCase):
    def test_book_summaries(self):
        self.assertEqual(
            audit_summary(_make_log("CREATE", "Book", details={"title": "The Great Gatsby"})),
            "Created book: The Great Gatsby"
        )
        self.assertEqual(
            audit_summary(_make_log("UPDATE", "Book", details={"title": "The Great Gatsby"})),
            "Updated book: The Great Gatsby"
        )
        self.assertEqual(
            audit_summary(_make_log("DELETE", "Book", details={"title": "The Great Gatsby"})),
            "Deleted book: The Great Gatsby"
        )

    def test_member_summaries(self):
        self.assertEqual(
            audit_summary(_make_log("CREATE", "Member", details={"name": "John Doe", "code": "M1"})),
            "Created member: John Doe"
        )
        self.assertEqual(
            audit_summary(_make_log("UPDATE", "Member", details={"name": "John Doe", "photo_updated": True})),
            "Updated member: John Doe (photo updated)"
        )
        self.assertEqual(
            audit_summary(_make_log("UPDATE", "Member", details={"name": "John Doe", "photo_removed": True})),
            "Updated member: John Doe (photo removed)"
        )

    def test_fine_summaries(self):
        self.assertEqual(
            audit_summary(_make_log("PAY_FINE", "Fine", details={"amount": "6.00", "member_name": "John Doe"})),
            "Paid fine of $6.00 for John Doe"
        )
        self.assertEqual(
            audit_summary(_make_log("WAIVE_FINE", "Fine", details={"amount": "6.00", "member_name": "John Doe"})),
            "Waived fine of $6.00 for John Doe"
        )

    def test_circulation_summaries(self):
        base = {"book_title": "Dune", "member_name": "Jane Roe"}
        self.assertEqual(
            audit_summary(_make_log("CHECKOUT", "Borrowing", details=base)),
            "Checked out book: Dune to Jane Roe"
        )
        self.assertEqual(
            audit_summary(_make_log("CHECKIN", "Borrowing", details={**base, "was_overdue": True})),
            "Returned book: Dune from Jane Roe (fine assessed)"
        )
        self.assertEqual(
            audit_summary(_make_log("RENEW", "Borrowing", details=base)),
            "Renewed loan: Dune for Jane Roe"
        )

    def test_reservation_summary(self):
        self.assertEqual(
            audit_summary(_make_log("RESERVATION", "Reservation", details={
                "event": "Reservation Created", "book_title": "Dune", "member_name": "Jane Roe"
            })),
            "Reservation Created: Dune (Jane Roe)"
        )

    def test_author_and_category_use_genre_word(self):
        self.assertEqual(
            audit_summary(_make_log("CREATE", "Category", details={"name": "Fiction"})),
            "Created genre: Fiction"
        )
        self.assertEqual(
            audit_summary(_make_log("CREATE", "Author", details={"name": "Frank Herbert"})),
            "Created author: Frank Herbert"
        )

    def test_session_and_unknown(self):
        self.assertEqual(
            audit_summary(_make_log("CREATE", "Session", details={"event": "Admin JWT Login", "username": "root"})),
            "Admin logged in (root)"
        )
        self.assertEqual(
            audit_summary(_make_log("DELETE", "Widget", entity_id="W-9")),
            "Deleted Widget #W-9"
        )


class AuditLogAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username="admin_audit",
            email="admin_audit@library.com",
            password="adminpassword"
        )

    def test_endpoint_requires_authentication(self):
        response = self.client.get('/api/v1/audit-logs/audit-logs/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_summary_included_in_api_response(self):
        _make_log("CREATE", "Book", entity_id="978-0000000001", details={"title": "API Book"})
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/audit-logs/audit-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first = response.json()["results"][0]
        self.assertIn("summary", first)
        self.assertEqual(first["summary"], "Created book: API Book")
