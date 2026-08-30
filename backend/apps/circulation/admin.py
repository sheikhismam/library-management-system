from django.contrib import admin
from django.utils.html import format_html
from .models import Borrowing, Fine, Reservation


@admin.register(Borrowing)
class BorrowingAdmin(admin.ModelAdmin):
    list_display = ('id', 'book_title', 'member_name', 'borrow_date', 'due_date', 'return_date', 'status_badge', 'overdue_status', 'renewal_count')
    list_filter = ('status', 'borrow_date', 'due_date', 'return_date')
    search_fields = ('book__title', 'book__isbn', 'member__first_name', 'member__last_name', 'member__member_code')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('book', 'member')

    def book_title(self, obj):
        return obj.book.title
    book_title.short_description = 'Book'

    def member_name(self, obj):
        return obj.member.full_name
    member_name.short_description = 'Member'

    def status_badge(self, obj):
        colors = {
            'BORROWED': 'blue',
            'RETURNED': 'green',
            'OVERDUE': 'red',
            'LOST': 'black',
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_badge.short_description = 'Status'

    def overdue_status(self, obj):
        if obj.is_overdue:
            days = obj.overdue_days
            return format_html('<span style="color: red; font-weight: bold;">{} days overdue</span>', days)
        return "On time"
    overdue_status.short_description = 'Overdue'


@admin.register(Fine)
class FineAdmin(admin.ModelAdmin):
    list_display = ('id', 'member_name', 'amount_display', 'status_badge', 'reason', 'paid_date', 'created_at')
    list_filter = ('status', 'created_at', 'paid_date')
    search_fields = ('member__first_name', 'member__last_name', 'member__member_code', 'reason')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('borrowing', 'member')
    actions = ['mark_as_paid', 'mark_as_waived']

    def member_name(self, obj):
        return obj.member.full_name
    member_name.short_description = 'Member'

    def amount_display(self, obj):
        return f"${obj.amount:.2f}"
    amount_display.short_description = 'Amount'

    def status_badge(self, obj):
        colors = {
            'PENDING': 'red',
            'PAID': 'green',
            'WAIVED': 'gray',
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_badge.short_description = 'Status'

    @admin.action(description='Mark selected fines as PAID')
    def mark_as_paid(self, request, queryset):
        for fine in queryset:
            fine.mark_as_paid()

    @admin.action(description='Mark selected fines as WAIVED')
    def mark_as_waived(self, request, queryset):
        for fine in queryset:
            fine.mark_as_waived()


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('id', 'book_title', 'member_name', 'priority', 'status_badge', 'reservation_date', 'expiry_date')
    list_filter = ('status', 'reservation_date')
    search_fields = ('book__title', 'book__isbn', 'member__first_name', 'member__last_name')
    readonly_fields = ('created_at',)
    raw_id_fields = ('book', 'member')

    def book_title(self, obj):
        return obj.book.title
    book_title.short_description = 'Book'

    def member_name(self, obj):
        return obj.member.full_name
    member_name.short_description = 'Member'

    def status_badge(self, obj):
        colors = {
            'PENDING': 'orange',
            'FULFILLED': 'green',
            'CANCELLED': 'red',
            'EXPIRED': 'gray',
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_badge.short_description = 'Status'
