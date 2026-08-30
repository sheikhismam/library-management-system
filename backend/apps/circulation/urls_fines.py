from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FineViewSet

router = DefaultRouter()
router.register(r'', FineViewSet, basename='fine')

urlpatterns = [
    path('', include(router.urls)),
]
