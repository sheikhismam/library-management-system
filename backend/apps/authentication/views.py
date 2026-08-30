from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer, UserDetailSerializer, ChangePasswordSerializer
from .models import AdminProfile
from apps.audit_logs.utils import log_activity


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            user_data = response.data.get('user', {})
            user_id = user_data.get('id')
            username = user_data.get('username')
            log_activity(
                request=request,
                action='CREATE',
                entity_type='Session',
                entity_id=user_id,
                details={'event': 'Admin JWT Login', 'username': username}
            )
        return response


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = AdminProfile.objects.get_or_create(user=request.user)
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        profile, _ = AdminProfile.objects.get_or_create(user=user)

        # Update basic user fields
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        if 'email' in request.data:
            user.email = request.data['email']
        user.save()

        # Update profile fields
        if 'phone' in request.data:
            profile.phone = request.data['phone']
        if 'role_title' in request.data:
            profile.role_title = request.data['role_title']
        if 'avatar' in request.FILES:
            profile.avatar = request.FILES['avatar']
        profile.save()

        log_activity(
            request=request,
            action='UPDATE',
            entity_type='AdminProfile',
            entity_id=user.id,
            details={'event': 'Admin profile updated'}
        )

        user.refresh_from_db()
        serializer = UserDetailSerializer(user)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'user': request.user},
        )
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({'old_password': ['Wrong password.']}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.validated_data['new_password'])
            user.save()

            log_activity(
                request=request,
                action='UPDATE',
                entity_type='AdminUser',
                entity_id=user.id,
                details={'event': 'Password changed'}
            )
            return Response({'detail': 'Password changed successfully.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
