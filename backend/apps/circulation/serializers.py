from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from .models import Borrowing, Fine, Reservation
from apps.books.models import Book
from apps.members.models import Member


class BookSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ['id', 'isbn', 'title', 'available_copies', 'total_copies', 'shelf_location', 'cover_image']


class MemberSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Member
        fields = ['id', 'member_code', 'first_name', 'last_name', 'full_name', 'email', 'phone', 'membership_status', 'max_borrow_limit']


class BorrowingListSerializer(serializers.ModelSerializer):
    book = BookSummarySerializer(read_only=True)
    member = MemberSummarySerializer(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    overdue_days = serializers.IntegerField(read_only=True)
    calculated_fine = serializers.SerializerMethodField()

    class Meta:
        model = Borrowing
        fields = [
            'id', 'book', 'member',
            'borrow_date', 'due_date', 'return_date',
            'status', 'is_overdue', 'overdue_days',
            'renewal_count', 'max_renewals',
            'calculated_fine', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'return_date', 'status', 'renewal_count', 'created_at', 'updated_at']

    def get_calculated_fine(self, obj):
        if obj.is_overdue and obj.status in ['BORROWED', 'OVERDUE']:
            return str(obj.calculate_fine_amount())
        return '0.00'


class BorrowingDetailSerializer(BorrowingListSerializer):
    fines = serializers.SerializerMethodField()

    class Meta(BorrowingListSerializer.Meta):
        fields = BorrowingListSerializer.Meta.fields + ['fines']

    def get_fines(self, obj):
        return [
            {
                'id': f.id,
                'amount': str(f.amount),
                'status': f.status,
                'reason': f.reason,
                'paid_date': f.paid_date,
                'created_at': f.created_at
            }
            for f in obj.fines.all()
        ]


class CheckoutRequestSerializer(serializers.Serializer):
    book_identifier = serializers.CharField(required=True, help_text="Book ID, ISBN, or QR code payload")
    member_identifier = serializers.CharField(required=True, help_text="Member ID, Member code, or QR code payload")
    loan_days = serializers.IntegerField(default=14, min_value=1, max_value=90, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class CheckinRequestSerializer(serializers.Serializer):
    borrowing_id = serializers.IntegerField(required=False)
    book_identifier = serializers.CharField(required=False, allow_blank=True, default='')
    member_identifier = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class RenewRequestSerializer(serializers.Serializer):
    additional_days = serializers.IntegerField(default=14, min_value=1, max_value=60, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class QRScanActionSerializer(serializers.Serializer):
    qr_payload = serializers.CharField(required=True, help_text="Raw scanned QR payload (e.g., LMS:BOOK:978... or LMS:MEMBER:MEM...)")


class FineSerializer(serializers.ModelSerializer):
    member = MemberSummarySerializer(read_only=True)
    book_title = serializers.CharField(source='borrowing.book.title', read_only=True)
    book_isbn = serializers.CharField(source='borrowing.book.isbn', read_only=True)
    borrow_date = serializers.DateTimeField(source='borrowing.borrow_date', read_only=True)
    due_date = serializers.DateTimeField(source='borrowing.due_date', read_only=True)
    return_date = serializers.DateTimeField(source='borrowing.return_date', read_only=True)

    class Meta:
        model = Fine
        fields = [
            'id', 'borrowing', 'member',
            'book_title', 'book_isbn',
            'borrow_date', 'due_date', 'return_date',
            'amount', 'status', 'daily_rate',
            'reason', 'paid_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'borrowing', 'member', 'amount', 'status', 'paid_date', 'created_at', 'updated_at']


class ReservationSerializer(serializers.ModelSerializer):
    book = BookSummarySerializer(read_only=True)
    member = MemberSummarySerializer(read_only=True)
    book_id = serializers.PrimaryKeyRelatedField(
        queryset=Book.objects.all(), source='book', write_only=True
    )
    member_id = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(), source='member', write_only=True
    )

    class Meta:
        model = Reservation
        fields = [
            'id', 'book', 'member', 'book_id', 'member_id',
            'reservation_date', 'status', 'priority',
            'expiry_date', 'notified_at', 'created_at'
        ]
        read_only_fields = ['id', 'reservation_date', 'status', 'priority', 'created_at']
