from rest_framework import serializers
from django.db.models import Avg
from .models import Author, Category, Book


class AuthorSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name', 'photo']


class AuthorSerializer(serializers.ModelSerializer):
    books_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Author
        fields = [
            'id', 'name', 'bio', 'birth_date', 'website', 'photo',
            'books_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'books_count', 'created_at', 'updated_at']


class CategorySummarySerializer(serializers.ModelSerializer):
    parent = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'parent']

    def get_parent(self, obj):
        if obj.parent_id and obj.parent:
            return {'id': obj.parent.id, 'name': obj.parent.name, 'slug': obj.parent.slug}
        return None


class CategorySerializer(serializers.ModelSerializer):
    books_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'parent',
            'books_count', 'created_at'
        ]
        read_only_fields = ['id', 'books_count', 'created_at']


class AuthorOrNameField(serializers.PrimaryKeyRelatedField):
    """
    Accept list items that are either an existing Author primary key (int)
    or a new author name (string). New names are normalised (whitespace is
    trimmed) and matched case-insensitively against existing authors to avoid
    duplicates; if no match exists the author is created automatically.
    """

    def to_internal_value(self, data):
        if isinstance(data, str):
            name = data.strip()
            if not name:
                raise serializers.ValidationError('Author name cannot be blank.')
            author = Author.objects.filter(name__iexact=name).first()
            if author is None:
                author = Author.objects.create(name=name)
            return author
        return super().to_internal_value(data)


class CategoryOrNameField(serializers.PrimaryKeyRelatedField):
    """
    Accept list items that are either an existing category id (int) or a
    Genre/Sub-genre descriptor:

      {"name": "Science Fiction"}                    -> new/existing Genre
      {"name": "Hard SF", "parent": 3}               -> Sub-genre of Genre id 3
      {"name": "Hard SF", "parent": {"name": "Sci Fic"}} -> Sub-genre of new Genre

    Names are normalized and matched case-insensitively (within the chosen
    parent for sub-genres) to avoid duplicate records.
    """

    def _resolve_parent(self, parent):
        if isinstance(parent, dict):
            name = str(parent.get('name', '')).strip()
            if name:
                parent = name
            elif parent.get('id') is not None:
                parent = parent['id']
        if isinstance(parent, str):
            name = parent.strip()
            if not name:
                raise serializers.ValidationError('Sub-genre parent name cannot be blank.')
            genre = Category.objects.filter(name__iexact=name, parent__isnull=True).first()
            if genre is None:
                genre = Category.objects.create(name=name)
            return genre
        genre = Category.objects.filter(pk=parent, parent__isnull=True).first()
        if genre is None:
            raise serializers.ValidationError(
                'Sub-genre parent must reference an existing Genre.'
            )
        return genre

    def to_internal_value(self, data):
        if isinstance(data, dict):
            name = str(data.get('name', '')).strip()
            if not name:
                raise serializers.ValidationError('Genre name cannot be blank.')
            parent = data.get('parent')
            if parent is None:
                genre = Category.objects.filter(name__iexact=name, parent__isnull=True).first()
                if genre is None:
                    genre = Category.objects.create(name=name)
                return genre
            parent_obj = self._resolve_parent(parent)
            sub = Category.objects.filter(name__iexact=name, parent=parent_obj).first()
            if sub is None:
                sub = Category.objects.create(name=name, parent=parent_obj)
            return sub
        return super().to_internal_value(data)


class BookListSerializer(serializers.ModelSerializer):
    authors = AuthorSummarySerializer(many=True, read_only=True)
    author_ids = AuthorOrNameField(
        many=True, queryset=Author.objects.all(), write_only=True, required=False
    )
    categories = CategorySummarySerializer(many=True, read_only=True)
    category_ids = CategoryOrNameField(
        many=True, queryset=Category.objects.all(), write_only=True, required=False
    )
    is_available = serializers.BooleanField(read_only=True)
    qr_payload = serializers.CharField(read_only=True)
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id', 'isbn', 'title', 'subtitle',
            'authors', 'author_ids',
            'categories', 'category_ids',
            'publisher', 'publication_date', 'publication_year',
            'edition', 'pages', 'language', 'price',
            'description', 'cover_image', 'cover_image_url',
            'qr_code_image', 'qr_payload',
            'total_copies', 'available_copies', 'shelf_location',
            'is_active', 'is_available',
            'average_rating', 'reviews_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'qr_code_image', 'qr_payload',
            'created_at', 'updated_at'
        ]

    def validate(self, attrs):
        # A Genre is required for every new book.
        if self.instance is None and 'category_ids' in attrs and not attrs['category_ids']:
            raise serializers.ValidationError({
                'category_ids': 'At least one Genre is required for every book.'
            })
        return attrs

    def create(self, validated_data):
        author_ids = validated_data.pop('author_ids', None)
        category_ids = validated_data.pop('category_ids', None)
        book = super().create(validated_data)
        if author_ids is not None:
            book.authors.set(author_ids)
        if category_ids is not None:
            book.categories.set(category_ids)
        return book

    def update(self, instance, validated_data):
        author_ids = validated_data.pop('author_ids', None)
        category_ids = validated_data.pop('category_ids', None)
        book = super().update(instance, validated_data)
        if author_ids is not None:
            book.authors.set(author_ids)
        if category_ids is not None:
            book.categories.set(category_ids)
        return book

    def get_average_rating(self, obj):
        avg = obj.reviews.filter(is_approved=True).aggregate(Avg('rating'))['rating__avg']
        return round(avg, 1) if avg else None

    def get_reviews_count(self, obj):
        return obj.reviews.filter(is_approved=True).count()


class BookDetailSerializer(BookListSerializer):
    recent_reviews = serializers.SerializerMethodField()

    class Meta(BookListSerializer.Meta):
        fields = BookListSerializer.Meta.fields + ['recent_reviews']

    def get_recent_reviews(self, obj):
        reviews = obj.reviews.filter(is_approved=True).order_by('-created_at')[:5]
        return [
            {
                'id': r.id,
                'reviewer_name': r.reviewer_name,
                'rating': r.rating,
                'comment': r.comment,
                'created_at': r.created_at
            }
            for r in reviews
        ]