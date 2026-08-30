from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CheckoutAPIView,
    CheckinAPIView,
    RenewAPIView,
    LoanViewSet,
    QRScanActionAPIView
)

router = DefaultRouter()
router.register(r'loans', LoanViewSet, basename='loan')

urlpatterns = [
    path('checkout/', CheckoutAPIView.as_view(), name='circulation_checkout'),
    path('checkin/', CheckinAPIView.as_view(), name='circulation_checkin'),
    path('renew/<int:pk>/', RenewAPIView.as_view(), name='circulation_renew'),
    path('qr-scan-action/', QRScanActionAPIView.as_view(), name='circulation_qr_scan_action'),
    path('overdue/', LoanViewSet.as_view({'get': 'overdue_loans'}), name='circulation_overdue'),
    path('', include(router.urls)),
]
