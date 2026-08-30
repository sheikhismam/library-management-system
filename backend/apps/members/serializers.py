from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from .models import Member


class MemberListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    qr_payload = serializers.CharField(read_only=True)
    active_loans_count = serializers.SerializerMethodField()
    can_borrow = serializers.BooleanField(read_only=True)
    joined_date = serializers.DateField(default=timezone.localdate, required=False)

    class Meta:
        model = Member
        fields = [
            'id', 'member_code', 'first_name', 'last_name', 'full_name',
            'email', 'phone', 'address',
            'membership_status', 'max_borrow_limit', 'photo',
            'qr_code_image', 'qr_payload',
            'joined_date', 'expiry_date', 'notes',
            'active_loans_count', 'can_borrow',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'member_code', 'photo', 'qr_code_image',
            'qr_payload', 'created_at', 'updated_at'
        ]

    def get_active_loans_count(self, obj):
        return obj.active_loans_count()


class MemberDetailSerializer(MemberListSerializer):
    active_loans = serializers.SerializerMethodField()
    unpaid_fines_total = serializers.SerializerMethodField()

    class Meta(MemberListSerializer.Meta):
        fields = MemberListSerializer.Meta.fields + ['active_loans', 'unpaid_fines_total']

    def get_active_loans(self, obj):
        loans = obj.borrowings.filter(status__in=['BORROWED', 'OVERDUE']).select_related('book').order_by('-borrow_date')
        return [
            {
                'id': loan.id,
                'book_id': loan.book.id,
                'book_title': loan.book.title,
                'book_isbn': loan.book.isbn,
                'borrow_date': loan.borrow_date,
                'due_date': loan.due_date,
                'status': loan.status,
                'is_overdue': loan.is_overdue,
                'overdue_days': loan.overdue_days,
                'renewal_count': loan.renewal_count
            }
            for loan in loans
        ]

    def get_unpaid_fines_total(self, obj):
        pending_fines = obj.fines.filter(status='PENDING')
        total = sum((f.amount for f in pending_fines), Decimal('0.00'))
        return str(total)
