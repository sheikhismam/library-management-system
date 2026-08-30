from django.contrib import admin
from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'book', 'reviewer_name', 'rating', 'is_approved', 'created_at')
    list_filter = ('rating', 'is_approved', 'created_at')
    search_fields = ('book__title', 'reviewer_name', 'comment')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('book', 'member')
