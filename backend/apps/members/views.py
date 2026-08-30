from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import APIException
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from .models import Member
from .serializers import MemberListSerializer, MemberDetailSerializer
from apps.audit_logs.utils import log_activity


class ProtectedDeleteError(APIException):
    status_code = 409
    default_detail = "This item cannot be deleted because it is referenced by other records."
    default_code = "protected_delete"


class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['member_code', 'first_name', 'last_name', 'email', 'phone']
    ordering_fields = ['joined_date', 'last_name', 'first_name', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MemberDetailSerializer
        return MemberListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(membership_status=status_param.upper())
        return qs

    def perform_create(self, serializer):
        member = serializer.save()
        log_activity(
            request=self.request,
            action='CREATE',
            entity_type='Member',
            entity_id=member.member_code,
            details={'name': member.full_name, 'email': member.email, 'code': member.member_code}
        )

    def perform_update(self, serializer):
        member = serializer.save()
        log_activity(
            request=self.request,
            action='UPDATE',
            entity_type='Member',
            entity_id=member.member_code,
            details={'name': member.full_name, 'status': member.membership_status}
        )

    def perform_destroy(self, instance):
        code = instance.member_code
        name = instance.full_name
        try:
            instance.delete()
        except ProtectedError as exc:
            raise ProtectedDeleteError(
                "This member cannot be deleted because they have borrowing records. "
                "Finalize their active borrowings first."
            ) from exc
        log_activity(
            request=self.request,
            action='DELETE',
            entity_type='Member',
            entity_id=code,
            details={'name': name, 'code': code}
        )

    @action(detail=True, methods=['post', 'delete'], url_path='photo')
    def photo(self, request, pk=None):
        """
        Upload (POST) or remove (DELETE) the member's profile photo.
        Stored in the existing Member `photo` ImageField.
        """
        member = self.get_object()
        if request.method == 'DELETE':
            member.photo = None
            member.save(update_fields=['photo'])
            log_activity(
                request=request,
                action='UPDATE',
                entity_type='Member',
                entity_id=member.member_code,
                details={'name': member.full_name, 'photo_removed': True}
            )
            serializer = self.get_serializer(member)
            return Response(serializer.data, status=status.HTTP_200_OK)

        image = request.FILES.get('photo')
        if not image:
            return Response(
                {'error': 'A photo file is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        member.photo = image
        member.save(update_fields=['photo'])
        member.refresh_from_db()
        log_activity(
            request=request,
            action='UPDATE',
            entity_type='Member',
            entity_id=member.member_code,
            details={'name': member.full_name, 'photo_updated': True}
        )
        serializer = self.get_serializer(member)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup_member(self, request):
        """
        Instant lookup of a member by code or QR code query param: ?code=MEM-2026-0001
        """
        code = request.query_params.get('code', '').strip()
        qr = request.query_params.get('qr', '').strip()
        query = code or qr

        if not query:
            return Response({'error': 'A code or qr query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Strip prefixes if provided as QR payload (e.g. 'LMS:MEMBER:MEM-2026-xxx')
        if query.startswith('LMS:MEMBER:'):
            query = query.replace('LMS:MEMBER:', '').strip()

        try:
            member = Member.objects.get(
                Q(member_code__iexact=query) | Q(email__iexact=query) | Q(phone__iexact=query)
            )
            serializer = MemberDetailSerializer(member, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Member.DoesNotExist:
            return Response({'error': f'No member found matching: {query}'}, status=status.HTTP_404_NOT_FOUND)
        except Member.MultipleObjectsReturned:
            member = Member.objects.filter(
                Q(member_code__iexact=query) | Q(email__iexact=query) | Q(phone__iexact=query)
            ).first()
            serializer = MemberDetailSerializer(member, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='history')
    def member_history(self, request, pk=None):
        """
        Returns full borrowing and fine history for this member.
        """
        member = self.get_object()
        borrowings = member.borrowings.select_related('book').order_by('-borrow_date')
        fines = member.fines.select_related('borrowing__book').order_by('-created_at')

        history_data = {
            'member': {
                'id': member.id,
                'member_code': member.member_code,
                'full_name': member.full_name,
                'membership_status': member.membership_status,
                'can_borrow': member.can_borrow
            },
            'borrowings': [
                {
                    'id': b.id,
                    'book_id': b.book.id,
                    'book_title': b.book.title,
                    'book_isbn': b.book.isbn,
                    'borrow_date': b.borrow_date,
                    'due_date': b.due_date,
                    'return_date': b.return_date,
                    'status': b.status,
                    'renewal_count': b.renewal_count
                }
                for b in borrowings
            ],
            'fines': [
                {
                    'id': f.id,
                    'amount': str(f.amount),
                    'status': f.status,
                    'reason': f.reason,
                    'paid_date': f.paid_date,
                    'created_at': f.created_at
                }
                for f in fines
            ]
        }
        return Response(history_data, status=status.HTTP_200_OK)
