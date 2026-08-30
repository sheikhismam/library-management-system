from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from apps.authentication.models import AdminProfile


class AuthenticationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.username = "admin_test"
        self.password = "pass12345"
        self.user = User.objects.create_user(
            username=self.username,
            email="admin_test@library.com",
            password=self.password,
            first_name="Admin",
            last_name="User",
            is_staff=True
        )
        self.profile = AdminProfile.objects.create(
            user=self.user,
            role_title="Head Librarian"
        )

    def test_health_check_endpoint(self):
        response = self.client.get('/api/v1/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['status'], 'healthy')

    def test_jwt_login_success(self):
        response = self.client.post('/api/v1/auth/login/', {
            'username': self.username,
            'password': self.password
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['username'], self.username)
        self.assertEqual(data['user']['role_title'], 'Head Librarian')

    def test_jwt_login_invalid_credentials(self):
        response = self.client.post('/api/v1/auth/login/', {
            'username': self.username,
            'password': 'wrongpassword'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        login_res = self.client.post('/api/v1/auth/login/', {
            'username': self.username,
            'password': self.password
        }, format='json')
        refresh_token = login_res.json()['refresh']

        refresh_res = self.client.post('/api/v1/auth/refresh/', {
            'refresh': refresh_token
        }, format='json')
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_res.json())

    def test_current_user_me_endpoint(self):
        # Unauthenticated request
        unauth_res = self.client.get('/api/v1/auth/me/')
        self.assertEqual(unauth_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated request
        self.client.force_authenticate(user=self.user)
        auth_res = self.client.get('/api/v1/auth/me/')
        self.assertEqual(auth_res.status_code, status.HTTP_200_OK)
        data = auth_res.json()
        self.assertEqual(data['username'], self.username)
        self.assertEqual(data['profile']['role_title'], 'Head Librarian')

    def test_current_user_profile_patch(self):
        self.client.force_authenticate(user=self.user)
        patch_res = self.client.patch('/api/v1/auth/me/', {
            'first_name': 'Super',
            'role_title': 'Chief Director'
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        data = patch_res.json()
        self.assertEqual(data['first_name'], 'Super')
        self.assertEqual(data['profile']['role_title'], 'Chief Director')

    def test_change_password_requires_authentication(self):
        response = self.client.post('/api/v1/auth/change-password/', {
            'old_password': self.password,
            'new_password': 'NewStr0ngPass2026',
            'confirm_password': 'NewStr0ngPass2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.user)
        new_password = 'NewStr0ngPass2026'
        response = self.client.post('/api/v1/auth/change-password/', {
            'old_password': self.password,
            'new_password': new_password,
            'confirm_password': new_password,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        self.assertFalse(self.user.check_password(self.password))

    def test_change_password_new_password_can_authenticate(self):
        self.client.force_authenticate(user=self.user)
        new_password = 'NewStr0ngPass2026'
        res = self.client.post('/api/v1/auth/change-password/', {
            'old_password': self.password,
            'new_password': new_password,
            'confirm_password': new_password,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # A fresh client logs in with the new password.
        fresh = APIClient()
        login_res = fresh.post('/api/v1/auth/login/', {
            'username': self.username,
            'password': new_password
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_res.json())

    def test_change_password_incorrect_current_password(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/v1/auth/change-password/', {
            'old_password': 'wrongpassword',
            'new_password': 'NewStr0ngPass2026',
            'confirm_password': 'NewStr0ngPass2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('old_password', response.json())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))

    def test_change_password_mismatched_confirmation(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/v1/auth/change-password/', {
            'old_password': self.password,
            'new_password': 'NewStr0ngPass2026',
            'confirm_password': 'DifferentPass2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.json())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))

    def test_change_password_invalid_new_password(self):
        self.client.force_authenticate(user=self.user)
        # All-numeric password fails Django's NumericPasswordValidator.
        response = self.client.post('/api/v1/auth/change-password/', {
            'old_password': self.password,
            'new_password': '123456',
            'confirm_password': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', response.json())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))
