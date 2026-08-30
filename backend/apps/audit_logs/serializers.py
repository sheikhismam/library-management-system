from rest_framework import serializers
from .models import AuditLog


def _safe(details, *keys, default=None):
    for key in keys:
        value = details.get(key) if details else None
        if value:
            return value
    return default


_CRUD_VERBS = {
    "CREATE": "Created",
    "UPDATE": "Updated",
    "DELETE": "Deleted",
}


def audit_summary(instance):
    """Build a concise, human-readable summary of an audit log entry.

    UI labels are English because entity names (book titles, member names)
    must remain untranslated; the raw JSON stays available in ``details``.
    """
    action = instance.action
    entity = instance.entity_type
    details = instance.details or {}
    verb = _CRUD_VERBS.get(action, action.title())

    name = _safe(details, "name", "title", "book_title", default=instance.entity_id)

    if entity == "Book":
        return f"{verb} book: {name}"

    if entity == "Member":
        extra = ""
        if details.get("photo_updated"):
            extra = " (photo updated)"
        elif details.get("photo_removed"):
            extra = " (photo removed)"
        return f"{verb} member: {name}{extra}"

    if entity == "Author":
        return f"{verb} author: {name}"

    if entity == "Category":
        return f"{verb} genre: {name}"

    if entity == "Borrowing":
        member = _safe(details, "member_name", default="member")
        if action == "CHECKOUT":
            return f"Checked out book: {name} to {member}"
        if action == "CHECKIN":
            suffix = " (fine assessed)" if details.get("was_overdue") else ""
            return f"Returned book: {name} from {member}{suffix}"
        if action == "RENEW":
            return f"Renewed loan: {name} for {member}"

    if entity == "Fine":
        amount = _safe(details, "amount", default="")
        member = _safe(details, "member_name", default="member")
        if action == "PAY_FINE":
            return f"Paid fine of ${amount} for {member}"
        if action == "WAIVE_FINE":
            return f"Waived fine of ${amount} for {member}"

    if entity == "Reservation":
        event = details.get("event") or "Reservation action"
        member = _safe(details, "member_name", default="")
        member_part = f" ({member})" if member else ""
        return f"{event}: {name}{member_part}"

    if entity == "Session":
        username = _safe(details, "username", default="")
        return f"Admin logged in ({username})" if username else "Admin logged in"

    if entity == "AdminProfile":
        return "Admin profile updated"

    if entity == "AdminUser":
        return "Password changed"

    return f"{verb} {entity} #{instance.entity_id}"


class AuditLogSerializer(serializers.ModelSerializer):
    summary = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'entity_type', 'entity_id',
            'details', 'ip_address', 'timestamp', 'user', 'summary'
        ]
        read_only_fields = [
            'id', 'action', 'entity_type', 'entity_id',
            'details', 'ip_address', 'timestamp', 'user', 'summary'
        ]

    def get_summary(self, instance):
        return audit_summary(instance)

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Mask sensitive details - never expose passwords, tokens, secrets
        if instance.details:
            details = instance.details
            # Redact potentially sensitive keys
            sensitive_keys = ['password', 'token', 'secret', 'key', 'credential']
            for key in sensitive_keys:
                if key in str(details).lower():
                    # We'll just mask the entire details if sensitive content detected
                    rep['details'] = '[Filtered]'
                    break
        return rep