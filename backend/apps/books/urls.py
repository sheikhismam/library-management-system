from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuthorViewSet, CategoryViewSet, BookViewSet

book_router = DefaultRouter()
book_router.register(r'', BookViewSet, basename='book')

author_router = DefaultRouter()
author_router.register(r'', AuthorViewSet, basename='author')

category_router = DefaultRouter()
category_router.register(r'', CategoryViewSet, basename='category')

urlpatterns = [
    path('', include(book_router.urls)),
]
