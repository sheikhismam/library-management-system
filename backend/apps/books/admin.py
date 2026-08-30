from django.contrib import admin
from django.utils.html import format_html
from .models import Author, Category, Book


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ('name', 'birth_date', 'website', 'books_count', 'created_at')
    search_fields = ('name', 'bio')
    list_filter = ('created_at',)
    readonly_fields = ('created_at', 'updated_at')

    def books_count(self, obj):
        return obj.books.count()
    books_count.short_description = 'Books'


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'books_count', 'created_at')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at',)

    def books_count(self, obj):
        return obj.books.count()
    books_count.short_description = 'Books'


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'isbn', 'display_authors', 'price', 'total_copies', 'available_copies', 'is_available_badge', 'shelf_location', 'qr_thumbnail')
    list_filter = ('is_active', 'categories', 'publication_year', 'language')
    search_fields = ('title', 'isbn', 'authors__name', 'publisher')
    filter_horizontal = ('authors', 'categories')
    readonly_fields = ('qr_code_image', 'qr_preview', 'created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('isbn', 'title', 'subtitle', 'authors', 'categories', 'description')
        }),
        ('Publication & Pricing', {
            'fields': ('publisher', 'publication_date', 'publication_year', 'edition', 'pages', 'language', 'price')
        }),
        ('Inventory & Location', {
            'fields': ('total_copies', 'available_copies', 'shelf_location', 'is_active')
        }),
        ('Media & Identification', {
            'fields': ('cover_image', 'qr_code_image', 'qr_preview')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def display_authors(self, obj):
        return ", ".join([a.name for a in obj.authors.all()])
    display_authors.short_description = 'Authors'

    def is_available_badge(self, obj):
        if obj.is_available:
            return format_html('<span style="color: green; font-weight: bold;">In Stock ({})</span>', obj.available_copies)
        return format_html('<span style="color: red; font-weight: bold;">Out of Stock</span>')
    is_available_badge.short_description = 'Status'

    def qr_thumbnail(self, obj):
        if obj.qr_code_image:
            return format_html('<img src="{}" style="width: 35px; height: 35px;" />', obj.qr_code_image.url)
        return "-"
    qr_thumbnail.short_description = 'QR'

    def qr_preview(self, obj):
        if obj.qr_code_image:
            return format_html('<img src="{}" style="max-width: 200px;" /><br/>Payload: <code>{}</code>', obj.qr_code_image.url, obj.qr_payload)
        return "Will be generated automatically upon saving."
    qr_preview.short_description = 'QR Code Preview'
