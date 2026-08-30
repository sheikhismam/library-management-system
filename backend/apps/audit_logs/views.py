from rest_framework import viewsets, filters, permissions
from django.db.models import Q
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['action', 'entity_type', 'details']
    ordering_fields = ['timestamp', 'action', 'entity_type']
    ordering = ['-timestamp']

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # Filter by action
        action = params.get('action')
        if action:
            qs = qs.filter(action=action.upper())

        # Filter by user/actor
        user_id = params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)

        # Filter by date range
        start_date = params.get('start')
        if start_date:
            qs = qs.filter(timestamp__gte=start_date)
        end_date = params.get('end')
        if end_date:
            qs = qs.filter(timestamp__lte=end_date)

        return qs