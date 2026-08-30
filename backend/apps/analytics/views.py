from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import datetime, timedelta
from apps.books.models import Book, Author, Category
from apps.members.models import Member
from apps.circulation.models import Borrowing, Fine


class AnalyticsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # --- Summary Statistics ---

        # Total books (distinct titles)
        total_books = Book.objects.count()

        # Total copies
        total_copies_aggregation = Book.objects.aggregate(
            total=Sum('total_copies')
        )
        total_copies = total_copies_aggregation['total'] or 0

        # Active loans (BORROWED or OVERDUE, not returned)
        active_loans = Borrowing.objects.filter(
            status__in=['BORROWED', 'OVERDUE']
        ).count()

        # Overdue loans (due_date in the past AND status BORROWED/OVERDUE)
        overdue_loans = Borrowing.objects.filter(
            status__in=['BORROWED', 'OVERDUE'],
            due_date__lt=timezone.now()
        ).count()

        # Total members
        total_members = Member.objects.count()

        # Total authors
        total_authors = Author.objects.count()

        # Total publishers (distinct publisher names across books)
        total_publishers = Book.objects.exclude(
            publisher__isnull=True
        ).exclude(
            publisher=""
        ).values('publisher').distinct().count()

        # Total genres (distinct categories)
        total_genres = Category.objects.count()

        # Total sub-genres (categories with a parent)
        total_sub_genres = Category.objects.filter(parent__isnull=False).count()

        # Fines collected (paid)
        fines_collected = Fine.objects.filter(status='PAID').aggregate(
            total=Sum('amount')
        )['total'] or 0

        # Fines pending
        fines_pending = Fine.objects.filter(status='PENDING').aggregate(
            total=Sum('amount')
        )['total'] or 0

        # --- Borrowing Activity (12-month timeline) ---
        now = timezone.now()
        twelve_months_ago = now - timedelta(days=365)

        # Use TruncMonth for proper year-month grouping
        monthly_borrows = Borrowing.objects.filter(
            borrow_date__gte=twelve_months_ago
        ).annotate(
            month=TruncMonth('borrow_date')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')

        # Build a complete 12-month timeline
        timeline = []
        for i in range(12):
            month_date = now - timedelta(days=30 * i)
            month_start = month_date.replace(day=1)
            month_end = month_start + timedelta(days=32)
            month_end = month_end.replace(day=1)

            count = Borrowing.objects.filter(
                borrow_date__gte=month_start,
                borrow_date__lt=month_end
            ).count()

            timeline.append({
                'month': month_start.strftime('%b %Y'),
                'count': count
            })

        # Reverse so oldest month is first (chronological order)
        timeline.reverse()

        # --- Popular Books (most borrowed) ---
        popular_books = Book.objects.annotate(
            borrow_count=Count('borrowings', distinct=True)
        ).order_by('-borrow_count')[:5]

        popular_books_data = [
            {
                'id': book.id,
                'title': book.title,
                'isbn': book.isbn,
                'borrow_count': book.borrow_count
            }
            for book in popular_books
        ]

        # --- Popular Categories ---
        popular_categories = Book.objects.values(
            'categories__id', 'categories__name'
        ).annotate(
            borrow_count=Count('borrowings', distinct=True)
        ).order_by('-borrow_count')[:5]

        popular_categories_data = [
            {
                'id': cat['categories__id'],
                'name': cat['categories__name'],
                'borrow_count': cat['borrow_count']
            }
            for cat in popular_categories
        ]

        # --- Recent Circulation Activity ---
        recent_borrowings = Borrowing.objects.select_related('book', 'member').order_by('-borrow_date')[:10]

        recent_activity = []
        for borrowing in recent_borrowings:
            recent_activity.append({
                'id': borrowing.id,
                'action': borrowing.status,
                'book_title': borrowing.book.title,
                'member_name': borrowing.member.full_name if borrowing.member else 'Unknown',
                'borrow_date': borrowing.borrow_date,
                'due_date': borrowing.due_date,
            })

        # Build the response
        response = {
            'summary': {
                'total_books': total_books,
                'total_copies': total_copies,
                'active_loans': active_loans,
                'overdue_loans': overdue_loans,
                'total_members': total_members,
                'total_authors': total_authors,
                'total_publishers': total_publishers,
                'total_genres': total_genres,
                'total_sub_genres': total_sub_genres,
                'fines_collected': str(fines_collected),
                'fines_pending': str(fines_pending),
            },
            'borrowing_activity': {
                'timeline': timeline
            },
            'popular_books': popular_books_data,
            'popular_categories': popular_categories_data,
            'recent_activity': recent_activity,
        }

        return Response(response)