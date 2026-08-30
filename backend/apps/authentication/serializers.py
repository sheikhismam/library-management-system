from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import AdminProfile


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        profile, _ = AdminProfile.objects.get_or_create(user=self.user)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role_title': profile.role_title,
            'avatar': profile.avatar.url if profile.avatar else None,
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
        }
        return data


class AdminProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminProfile
        fields = ['avatar', 'phone', 'role_title', 'created_at', 'updated_at']


class UserDetailSerializer(serializers.ModelSerializer):
    profile = AdminProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'last_login', 'date_joined', 'profile']
        read_only_fields = ['id', 'username', 'is_staff', 'is_superuser', 'last_login', 'date_joined']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)
    confirm_password = serializers.CharField(required=True)

    def validate(self, attrs):
        user = self.context.get('user')
        new_password = attrs.get('new_password')
        confirm_password = attrs.get('confirm_password')

        if new_password and confirm_password and new_password != confirm_password:
            raise serializers.ValidationError(
                {'confirm_password': 'New passwords do not match.'}
            )

        if new_password:
            try:
                password_validation.validate_password(new_password, user=user)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(
                    {'new_password': list(exc.messages)}
                )
        return attrs
