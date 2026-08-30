from decimal import Decimal
from datetime import timedelta
from django.db import models
from django.utils import timezone
from apps.books.models import Book
from apps.members.models import Member


class Borrowing(models.Model):
    STATUS_CHOICES = (
        ('BORROWED', 'Borrowed'),
        ('RETURNED', 'Returned'),
        ('OVERDUE', 'Overdue'),
        ('LOST', 'Lost'),
    )

    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name='borrowings')
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name='borrowings')
    borrow_date = models.DateTimeField(default=timezone.now)
    due_date = models.DateTimeField()
    return_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='BORROWED', db_index=True)
    renewal_count = models.PositiveIntegerField(default=0)
    max_renewals = models.PositiveIntegerField(default=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-borrow_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
            models.Index(fields=['borrow_date']),
        ]

    @property
    def is_overdue(self):
        if self.status == 'RETURNED':
            if self.return_date and self.return_date > self.due_date:
                return True
            return False
        return timezone.now() > self.due_date

    @property
    def overdue_days(self):
        if not self.is_overdue:
            return 0
        ref_time = self.return_date if self.return_date else timezone.now()
        delta = ref_time - self.due_date
        return max(0, delta.days)

    def calculate_fine_amount(self, daily_rate=Decimal('1.00')):
        days = self.overdue_days
        return Decimal(days) * daily_rate

    def save(self, *args, **kwargs):
        if not self.due_date:
            # Default loan period: 14 days
            self.due_date = self.borrow_date + timedelta(days=14)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.book.title} borrowed by {self.member.full_name} ({self.status})"


class Fine(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('WAIVED', 'Waived'),
    )

    borrowing = models.ForeignKey(Borrowing, on_delete=models.CASCADE, related_name='fines')
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='fines')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    daily_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('1.00'))
    reason = models.CharField(max_length=255, default='Overdue book return')
    paid_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def mark_as_paid(self):
        self.status = 'PAID'
        self.paid_date = timezone.now()
        self.save(update_fields=['status', 'paid_date', 'updated_at'])

    def mark_as_waived(self):
        self.status = 'WAIVED'
        self.save(update_fields=['status', 'updated_at'])

    def __str__(self):
        return f"Fine: ${self.amount} for {self.member.full_name} ({self.status})"


class Reservation(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('FULFILLED', 'Fulfilled'),
        ('CANCELLED', 'Cancelled'),
        ('EXPIRED', 'Expired'),
    )

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='reservations')
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='reservations')
    reservation_date = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    priority = models.PositiveIntegerField(default=1)
    expiry_date = models.DateTimeField(null=True, blank=True)
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority', 'reservation_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
        ]

    def __str__(self):
        return f"Reservation: {self.book.title} for {self.member.full_name} ({self.status})"
