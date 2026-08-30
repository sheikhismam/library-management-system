"""
URL configuration for library_project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify backend service status.
    """
    return Response({
        'status': 'healthy',
        'service': 'Library Management System API',
        'version': '1.0.0',
        'timestamp': timezone.now().isoformat(),
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API v1 Endpoints
    path('api/v1/health/', health_check, name='health_check'),
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/books/', include('apps.books.urls')),
    path('api/v1/authors/', include('apps.books.urls_authors')),
    path('api/v1/categories/', include('apps.books.urls_categories')),
    path('api/v1/members/', include('apps.members.urls')),
    path('api/v1/circulation/', include('apps.circulation.urls')),
    path('api/v1/fines/', include('apps.circulation.urls_fines')),
    path('api/v1/reservations/', include('apps.circulation.urls_reservations')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/audit-logs/', include('apps.audit_logs.urls')),
    path('api/v1/analytics/dashboard/', include('apps.analytics.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
