from io import BytesIO
from django.db import models
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.text import slugify
import qrcode


class Author(models.Model):
    name = models.CharField(max_length=255, db_index=True)
    bio = models.TextField(blank=True)
    birth_date = models.DateField(null=True, blank=True)
    website = models.URLField(blank=True)
    photo = models.ImageField(upload_to='authors/photos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        related_name='children',
        on_delete=models.CASCADE,
        verbose_name='Parent Genre',
        help_text='Set this to make the category a Sub-genre of another (parent) Genre.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Genres'
        verbose_name = 'Genre'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'category'
            slug = base
            counter = 2
            existing = Category.objects.exclude(pk=self.pk)
            while existing.filter(slug=slug).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        if self.parent_id:
            return f"{self.parent.name} / {self.name}"
        return self.name


class Book(models.Model):
    isbn = models.CharField(max_length=20, unique=True, db_index=True)
    title = models.CharField(max_length=255, db_index=True)
    subtitle = models.CharField(max_length=255, blank=True)
    authors = models.ManyToManyField(Author, related_name='books', blank=True)
    categories = models.ManyToManyField(Category, related_name='books', blank=True)
    publisher = models.CharField(max_length=200, blank=True)
    publication_date = models.DateField(null=True, blank=True)
    publication_year = models.PositiveIntegerField(null=True, blank=True)
    edition = models.CharField(max_length=50, blank=True)
    pages = models.PositiveIntegerField(null=True, blank=True)
    language = models.CharField(max_length=50, default='English')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to='books/covers/', null=True, blank=True)
    cover_image_url = models.URLField(
        blank=True,
        default='',
        help_text='Alternative cover source: a publicly reachable image URL, used when no local cover image is uploaded.'
    )
    qr_code_image = models.ImageField(upload_to='books/qrcodes/', null=True, blank=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    shelf_location = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['isbn']),
            models.Index(fields=['title']),
            models.Index(fields=['is_active']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(available_copies__lte=models.F('total_copies')),
                name='available_copies_lte_total_copies'
            ),
            models.CheckConstraint(
                condition=models.Q(available_copies__gte=0),
                name='available_copies_gte_zero'
            ),
        ]

    def clean(self):
        super().clean()
        if self.available_copies > self.total_copies:
            raise ValidationError({'available_copies': 'Available copies cannot exceed total copies.'})
        if self.available_copies < 0:
            raise ValidationError({'available_copies': 'Available copies cannot be negative.'})

    @property
    def is_available(self):
        return self.is_active and self.available_copies > 0

    @property
    def qr_payload(self):
        return f"LMS:BOOK:{self.isbn}"

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
            filename = f"qr_book_{self.isbn.replace('-', '_')}.png"
            self.qr_code_image.save(filename, ContentFile(buffer.getvalue()), save=False)

    def save(self, *args, **kwargs):
        self.clean()
        if self.publication_date and not self.publication_year:
            self.publication_year = self.publication_date.year
        self.generate_qr_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} (ISBN: {self.isbn})"
