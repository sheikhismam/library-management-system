from django.test import TestCase
from apps.books.models import Book
from apps.members.models import Member
from .models import Review


class ReviewModelTests(TestCase):
    def setUp(self):
        self.book = Book.objects.create(
            isbn="978-0201616224",
            title="The Pragmatic Programmer",
            total_copies=2,
            available_copies=2
        )
        self.member = Member.objects.create(
            member_code="MEM-2026-0088",
            first_name="Ada",
            last_name="Lovelace",
            email="ada@example.com",
            phone="+1-555-0188"
        )

    def test_review_creation(self):
        review = Review.objects.create(
            book=self.book,
            member=self.member,
            reviewer_name=self.member.full_name,
            rating=5,
            comment="Essential reading for every software engineer."
        )
        self.assertEqual(review.rating, 5)
        self.assertTrue(review.is_approved)
        self.assertEqual(self.book.reviews.count(), 1)
