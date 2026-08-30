from io import BytesIO
from django.db import models
from django.utils import timezone
from django.core.files.base import ContentFile
import qrcode
import uuid


class Member(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('SUSPENDED', 'Suspended'),
        ('INACTIVE', 'Inactive'),
    )

    member_code = models.CharField(max_length=30, unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=30)
    address = models.TextField(blank=True)
    membership_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    max_borrow_limit = models.PositiveIntegerField(default=5)
    photo = models.ImageField(upload_to='members/photos/', null=True, blank=True)
    qr_code_image = models.ImageField(upload_to='members/qrcodes/', null=True, blank=True)
    joined_date = models.DateField(default=timezone.localdate)
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['member_code']),
            models.Index(fields=['email']),
            models.Index(fields=['membership_status']),
        ]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def qr_payload(self):
        return f"LMS:MEMBER:{self.member_code}"

    @property
    def is_active_member(self):
        return self.membership_status == 'ACTIVE'

    def active_loans_count(self):
        return self.borrowings.filter(status__in=['BORROWED', 'OVERDUE']).count()

    @property
    def can_borrow(self):
        return self.is_active_member and (self.active_loans_count() < self.max_borrow_limit)

    def generate_qr_code(self, force=False):
        if not self.qr_code_image or force:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=8,
                border=2,
            )
            qr.add_data(self.qr_payload)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            filename = f"qr_member_{self.member_code.replace('-', '_')}.png"
            self.qr_code_image.save(filename, ContentFile(buffer.getvalue()), save=False)

    def save(self, *args, **kwargs):
        if not self.member_code:
            year = timezone.now().year
            short_id = uuid.uuid4().hex[:6].upper()
            self.member_code = f"MEM-{year}-{short_id}"
        self.generate_qr_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.member_code})"
