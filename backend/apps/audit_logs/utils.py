from .models import AuditLog


def get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_activity(request, action, entity_type, entity_id, details=None, user=None):
    """
    Safely record an administrative activity to the AuditLog table.
    """
    try:
        actor = user
        if not actor and request and hasattr(request, 'user'):
            if request.user.is_authenticated:
                actor = request.user
        ip = get_client_ip(request) if request else None

        return AuditLog.objects.create(
            user=actor,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            details=details or {},
            ip_address=ip
        )
    except Exception:
        # Never break main business transactions due to logging anomalies
        return None
