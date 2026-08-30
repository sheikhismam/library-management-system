from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import APIException
from django.db.models import Count, Q
from django.db.models.deletion import ProtectedError
from .models import Author, Category, Book
from .serializers import (
    AuthorSerializer,
    CategorySerializer,
    BookListSerializer,
    BookDetailSerializer
)
from apps.audit_logs.utils import log_activity


class ProtectedDeleteError(APIException):
    status_code = 409
    default_detail = "This item cannot be deleted because it is referenced by other records."
    default_code = "protected_delete"


class AuthorViewSet(viewsets.ModelViewSet):
    queryset = Author.objects.annotate(books_count=Count('books')).all()
    serializer_class = AuthorSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'bio']
    ordering_fields = ['name', 'created_at', 'books_count']
    ordering = ['name']

    def perform_create(self, serializer):
        author = serializer.save()
        log_activity(
            request=self.request,
            action='CREATE',
            entity_type='Author',
            entity_id=author.id,
            details={'name': author.name}
        )

    def perform_update(self, serializer):
        author = serializer.save()
        log_activity(
            request=self.request,
            action='UPDATE',
            entity_type='Author',
            entity_id=author.id,
            details={'name': author.name}
        )

    def perform_destroy(self, instance):
        author_id = instance.id
        author_name = instance.name
        instance.delete()
        log_activity(
            request=self.request,
            action='DELETE',
            entity_type='Author',
            entity_id=author_id,
            details={'name': author_name}
        )


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(books_count=Count('books')).all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'books_count']
    ordering = ['name']

    def perform_create(self, serializer):
        category = serializer.save()
        log_activity(
            request=self.request,
            action='CREATE',
            entity_type='Category',
            entity_id=category.id,
            details={'name': category.name}
        )

    def perform_update(self, serializer):
        category = serializer.save()
        log_activity(
            request=self.request,
            action='UPDATE',
            entity_type='Category',
            entity_id=category.id,
            details={'name': category.name}
        )

    def perform_destroy(self, instance):
        cat_id = instance.id
        cat_name = instance.name
        instance.delete()
        log_activity(
            request=self.request,
            action='DELETE',
            entity_type='Category',
            entity_id=cat_id,
            details={'name': cat_name}
        )


class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.prefetch_related('authors', 'categories').all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'subtitle', 'isbn', 'authors__name', 'publisher', 'shelf_location']
    ordering_fields = ['title', 'publication_year', 'price', 'available_copies', 'total_copies', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BookDetailSerializer
        return BookListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # Filter by category (id or slug)
        category = params.get('category')
        if category:
            if category.isdigit():
                qs = qs.filter(categories__id=category)
            else:
                qs = qs.filter(categories__slug=category)

        # Filter by author ID
        author_id = params.get('author')
        if author_id:
            qs = qs.filter(authors__id=author_id)

        # Filter by stock availability
        in_stock = params.get('in_stock')
        if in_stock is not None:
            if in_stock.lower() in ('true', '1'):
                qs = qs.filter(available_copies__gt=0, is_active=True)
            elif in_stock.lower() in ('false', '0'):
                qs = qs.filter(Q(available_copies=0) | Q(is_active=False))

        # Filter by active status
        is_active = params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))

        # Filter by publication year range
        year_from = params.get('year_from')
        if year_from and year_from.isdigit():
            qs = qs.filter(publication_year__gte=int(year_from))
        
        year_to = params.get('year_to')
        if year_to and year_to.isdigit():
            qs = qs.filter(publication_year__lte=int(year_to))

        return qs.distinct()

    def perform_create(self, serializer):
        book = serializer.save()
        log_activity(
            request=self.request,
            action='CREATE',
            entity_type='Book',
            entity_id=book.isbn,
            details={'title': book.title, 'isbn': book.isbn, 'total_copies': book.total_copies}
        )

    def perform_update(self, serializer):
        book = serializer.save()
        log_activity(
            request=self.request,
            action='UPDATE',
            entity_type='Book',
            entity_id=book.isbn,
            details={'title': book.title, 'available_copies': book.available_copies}
        )

    def perform_destroy(self, instance):
        isbn = instance.isbn
        title = instance.title
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ProtectedDeleteError(
                "This book cannot be deleted because it has borrowings. "
                "Finish the active borrowings or return the copies first."
            ) from exc
        log_activity(
            request=self.request,
            action='DELETE',
            entity_type='Book',
            entity_id=isbn,
            details={'title': title, 'isbn': isbn}
        )

    @action(detail=False, methods=['get'], url_path='lookup-isbn')
    def lookup_isbn(self, request):
        """
        Instant lookup of a book by ISBN query parameter: ?isbn=978-xxxx
        """
        isbn = request.query_params.get('isbn', '').strip()
        if not isbn:
            return Response({'error': 'ISBN query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Strip prefixes if scanned as QR payload (e.g., 'LMS:BOOK:978-xxx')
        if isbn.startswith('LMS:BOOK:'):
            isbn = isbn.replace('LMS:BOOK:', '').strip()

        try:
            book = Book.objects.prefetch_related('authors', 'categories').get(isbn__iexact=isbn)
            serializer = BookDetailSerializer(book, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Book.DoesNotExist:
            return Response({'error': f'No book found with ISBN: {isbn}'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='publishers')
    def list_publishers(self, request):
        """
        Distinct publisher names currently in use, for the type-or-select UX.
        Values are trimmed and de-duplicated case-insensitively.
        """
        raw = Book.objects.exclude(publisher='').values_list('publisher', flat=True)
        names = {p.strip() for p in raw if p and p.strip()}
        return Response({'publishers': sorted(names, key=lambda s: s.lower())})

    @action(detail=True, methods=['post', 'delete'], url_path='cover')
    def cover(self, request, pk=None):
        """
        Upload (POST) or remove (DELETE) the local cover image for a book.
        The image is stored in the existing `cover_image` ImageField.
        """
        book = self.get_object()
        if request.method == 'DELETE':
            book.cover_image = None
            book.save(update_fields=['cover_image'])
            log_activity(
                request=request,
                action='UPDATE',
                entity_type='Book',
                entity_id=book.isbn,
                details={'title': book.title, 'cover_removed': True}
            )
            serializer = BookDetailSerializer(book, context=self.get_serializer_context())
            return Response(serializer.data, status=status.HTTP_200_OK)

        image = request.FILES.get('cover_image')
        if not image:
            return Response(
                {'error': 'A cover_image file is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        book.cover_image = image
        book.save(update_fields=['cover_image'])
        book.refresh_from_db()
        log_activity(
            request=request,
            action='UPDATE',
            entity_type='Book',
            entity_id=book.isbn,
            details={'title': book.title, 'cover_updated': True}
        )
        serializer = BookDetailSerializer(book, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_200_OK)
