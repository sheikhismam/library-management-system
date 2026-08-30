from django.contrib import admin
from django.utils.html import format_html
from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('member_code', 'full_name', 'email', 'phone', 'membership_status_badge', 'max_borrow_limit', 'active_loans', 'qr_thumbnail', 'joined_date')
    list_filter = ('membership_status', 'joined_date')
    search_fields = ('member_code', 'first_name', 'last_name', 'email', 'phone')
    readonly_fields = ('qr_code_image', 'qr_preview', 'created_at', 'updated_at')
    fieldsets = (
        ('Identification & Profile', {
            'fields': ('member_code', 'first_name', 'last_name', 'email', 'phone', 'address')
        }),
        ('Membership Details', {
            'fields': ('membership_status', 'max_borrow_limit', 'joined_date', 'expiry_date', 'notes')
        }),
        ('Digital Badge & QR', {
            'fields': ('qr_code_image', 'qr_preview')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def membership_status_badge(self, obj):
        colors = {
            'ACTIVE': 'green',
            'EXPIRED': 'orange',
            'SUSPENDED': 'red',
            'INACTIVE': 'gray',
        }
        color = colors.get(obj.membership_status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_membership_status_display())
    membership_status_badge.short_description = 'Status'

    def active_loans(self, obj):
        return obj.active_loans_count()
    active_loans.short_description = 'Active Loans'

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
