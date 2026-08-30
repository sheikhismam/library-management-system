from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.utils import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient
from .models import Author, Category, Book
from apps.audit_logs.models import AuditLog


class BookModelTests(TestCase):
    def setUp(self):
        self.author1 = Author.objects.create(
            name="Robert C. Martin",
            bio="Software engineer and author",
            birth_date=date(1952, 12, 5),
            website="https://cleancoder.com"
        )
        self.author2 = Author.objects.create(
            name="Martin Fowler",
            bio="Software architect and author"
        )
        self.category = Category.objects.create(
            name="Software Engineering",
            description="Software design and architecture"
        )

    def test_category_slug_generation(self):
        self.assertEqual(self.category.slug, "software-engineering")

    def test_book_creation_with_multiple_authors_and_qr(self):
        book = Book.objects.create(
            isbn="978-0132350884",
            title="Clean Code",
            subtitle="A Handbook of Agile Software Craftsmanship",
            publisher="Prentice Hall",
            publication_date=date(2008, 8, 1),
            edition="1st Edition",
            pages=464,
            language="English",
            price=Decimal("39.99"),
            total_copies=5,
            available_copies=5,
            shelf_location="Aisle 4, Shelf B"
        )
        book.authors.add(self.author1, self.author2)
        book.categories.add(self.category)

        self.assertEqual(book.publication_year, 2008)
        self.assertEqual(book.authors.count(), 2)
        self.assertEqual(book.categories.count(), 1)
        self.assertTrue(book.is_available)
        self.assertEqual(book.qr_payload, "LMS:BOOK:978-0132350884")
        self.assertTrue(bool(book.qr_code_image))

    def test_book_stock_constraints(self):
        with self.assertRaises(ValidationError):
            invalid_book = Book(
                isbn="978-0000000001",
                title="Invalid Stock Book",
                total_copies=2,
                available_copies=5
            )
            invalid_book.full_clean()

        with self.assertRaises(ValidationError):
            invalid_book = Book(
                isbn="978-0000000002",
                title="Negative Stock Book",
                total_copies=5,
                available_copies=-1
            )
            invalid_book.full_clean()

    def test_unique_isbn_constraint(self):
        Book.objects.create(
            isbn="978-1111111111",
            title="First Book",
            total_copies=3,
            available_copies=3
        )
        with self.assertRaises(IntegrityError):
            Book.objects.create(
                isbn="978-1111111111",
                title="Duplicate ISBN Book",
                total_copies=1,
                available_copies=1
            )


class BookAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_api",
            email="admin_api@library.com",
            password="adminpassword"
        )
        self.author = Author.objects.create(name="Andrew Hunt")
        self.category = Category.objects.create(name="Programming")
        self.book = Book.objects.create(
            isbn="978-0201616224",
            title="The Pragmatic Programmer",
            publisher="Addison-Wesley",
            price=Decimal("45.00"),
            total_copies=4,
            available_copies=4,
            shelf_location="Section A"
        )
        self.book.authors.add(self.author)
        self.book.categories.add(self.category)

    def test_unauthorized_access(self):
        response = self.client.get('/api/v1/books/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_author_api_crud(self):
        self.client.force_authenticate(user=self.admin)
        
        # Create author
        create_res = self.client.post('/api/v1/authors/', {
            'name': 'Donald Knuth',
            'bio': 'Computer scientist'
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        author_id = create_res.json()['id']

        # List authors
        list_res = self.client.get('/api/v1/authors/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.json()['count'], 2)

        # Retrieve author
        get_res = self.client.get(f'/api/v1/authors/{author_id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.json()['name'], 'Donald Knuth')

        # Update author
        update_res = self.client.patch(f'/api/v1/authors/{author_id}/', {
            'website': 'https://www-cs-faculty.stanford.edu/~knuth/'
        }, format='json')
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertIn('stanford.edu', update_res.json()['website'])

        # Delete author
        del_res = self.client.delete(f'/api/v1/authors/{author_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_category_api_crud(self):
        self.client.force_authenticate(user=self.admin)
        
        # Create category
        create_res = self.client.post('/api/v1/categories/', {
            'name': 'Data Structures',
            'description': 'Algorithms and structures'
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        cat_id = create_res.json()['id']
        self.assertEqual(create_res.json()['slug'], 'data-structures')

        # List categories
        list_res = self.client.get('/api/v1/categories/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.json()['count'], 2)

        # Delete category
        del_res = self.client.delete(f'/api/v1/categories/{cat_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_book_api_crud_and_lookup(self):
        self.client.force_authenticate(user=self.admin)

        # Create book
        create_res = self.client.post('/api/v1/books/', {
            'isbn': '978-0134494166',
            'title': 'Clean Architecture',
            'author_ids': [self.author.id],
            'category_ids': [self.category.id],
            'publisher': 'Prentice Hall',
            'price': '42.50',
            'total_copies': 3,
            'available_copies': 3,
            'shelf_location': 'Shelf B1'
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        data = create_res.json()
        self.assertEqual(data['title'], 'Clean Architecture')
        self.assertEqual(data['qr_payload'], 'LMS:BOOK:978-0134494166')
        self.assertTrue(data['is_available'])
        book_id = data['id']

        # Verify audit log was created
        self.assertTrue(AuditLog.objects.filter(entity_type='Book', entity_id='978-0134494166', action='CREATE').exists())

        # List books with search
        search_res = self.client.get('/api/v1/books/?search=Architecture')
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertEqual(search_res.json()['count'], 1)

        # Lookup by ISBN endpoint
        lookup_res = self.client.get('/api/v1/books/lookup-isbn/?isbn=978-0134494166')
        self.assertEqual(lookup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(lookup_res.json()['title'], 'Clean Architecture')

        # Lookup with QR format string
        qr_lookup_res = self.client.get('/api/v1/books/lookup-isbn/?isbn=LMS:BOOK:978-0134494166')
        self.assertEqual(qr_lookup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(qr_lookup_res.json()['title'], 'Clean Architecture')

        # Update book
        update_res = self.client.patch(f'/api/v1/books/{book_id}/', {
            'price': '39.99'
        }, format='json')
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.json()['price'], '39.99')

        # Delete book
        del_res = self.client.delete(f'/api/v1/books/{book_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(AuditLog.objects.filter(entity_type='Book', entity_id='978-0134494166', action='DELETE').exists())


class BookGenreAuthorPublisherTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_phase_a",
            email="admin_phase_a@library.com",
            password="adminpassword"
        )
        self.client.force_authenticate(user=self.admin)
        self.genre = Category.objects.create(name="Science Fiction")
        self.publisher = "Tor Books"

    def _book_payload(self, **overrides):
        payload = {
            'isbn': '978-0765377067',
            'title': 'The Way of Kings',
            'category_ids': [self.genre.id],
            'publisher': self.publisher,
            'total_copies': 3,
            'available_copies': 3,
        }
        payload.update(overrides)
        return payload

    def test_create_book_with_new_author_name(self):
        res = self.client.post('/api/v1/books/', self._book_payload(
            author_ids=['Brandon Sanderson'],
            isbn='978-0765377067'
        ), format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        author = Author.objects.get(name='Brandon Sanderson')
        self.assertEqual(res.json()['authors'][0]['name'], 'Brandon Sanderson')
        # A second new-author name with different casing reuses the author.
        res2 = self.client.post('/api/v1/books/', self._book_payload(
            author_ids=['  brandon sanderson  '],
            isbn='978-0765326355'
        ), format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED, res2.content)
        self.assertEqual(Author.objects.filter(name__iexact='brandon sanderson').count(), 1)

    def test_create_book_with_new_genre_and_sub_genre(self):
        res = self.client.post('/api/v1/books/', self._book_payload(
            category_ids=[
                {'name': 'Fantasy'},
                {'name': 'Epic Fantasy', 'parent': {'name': 'Fantasy'}},
            ],
            isbn='978-0765326355'
        ), format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.content)
        fantasy = Category.objects.get(name__iexact='fantasy', parent__isnull=True)
        sub = Category.objects.get(name__iexact='epic fantasy', parent=fantasy)
        self.assertEqual(sub.parent, fantasy)
        names = {c['name'] for c in res.json()['categories']}
        self.assertEqual(names, {'Fantasy', 'Epic Fantasy'})

    def test_genre_required_on_create(self):
        res = self.client.post('/api/v1/books/', self._book_payload(
            category_ids=[],
            isbn='978-0765377067'
        ), format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('category_ids', res.json())

    def test_publishers_endpoint(self):
        Book.objects.create(
            isbn='978-0765377067', title='Existing Book',
            publisher='tor books', total_copies=1, available_copies=1
        )
        res = self.client.get('/api/v1/books/publishers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(name.lower() == 'tor books' for name in res.json()['publishers'])
        )

    def test_cover_upload_and_remove(self):
        create_res = self.client.post('/api/v1/books/', self._book_payload(
            isbn='978-0765377067'
        ), format='json')
        book_id = create_res.json()['id']
        cover = SimpleUploadedFile(
            'cover.png', b'fake-image-bytes', content_type='image/png'
        )
        up = self.client.post(
            f'/api/v1/books/{book_id}/cover/', {'cover_image': cover}, format='multipart'
        )
        self.assertEqual(up.status_code, status.HTTP_200_OK, up.content)
        self.assertIn('cover_image', up.json())
        self.assertTrue(up.json()['cover_image'])
        Book.objects.get(pk=book_id).cover_image.delete(save=False)
        rm = self.client.delete(f'/api/v1/books/{book_id}/cover/')
        self.assertEqual(rm.status_code, status.HTTP_200_OK)
        self.assertIsNone(rm.json()['cover_image'])
