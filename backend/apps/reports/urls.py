from django.urls import path
from .views import (
    inventory_report,
    overdue_report,
    member_report,
    guide_content,
    guide_pdf,
)

urlpatterns = [
    path("inventory/", inventory_report, name="inventory"),
    path("overdue/", overdue_report, name="overdue"),
    path("member/<int:member_id>/", member_report, name="member_report"),
    path("guide/content/", guide_content, name="guide_content"),
    path("guide/pdf/", guide_pdf, name="guide_pdf"),
]