from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.utils import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient
from .models import Member
from apps.audit_logs.models import AuditLog


class MemberModelTests(TestCase):
    def test_member_creation_and_auto_code(self):
        member = Member.objects.create(
            first_name="Alice",
            last_name="Johnson",
            email="alice.johnson@example.com",
            phone="+1-555-0199",
            address="123 Library Way, Booktown"
        )
        self.assertTrue(member.member_code.startswith("MEM-"))
        self.assertEqual(member.full_name, "Alice Johnson")
        self.assertTrue(member.is_active_member)
        self.assertTrue(member.can_borrow)
        self.assertEqual(member.qr_payload, f"LMS:MEMBER:{member.member_code}")
        self.assertTrue(bool(member.qr_code_image))

    def test_unique_member_code_and_email(self):
        Member.objects.create(
            member_code="MEM-TEST-001",
            first_name="Bob",
            last_name="Smith",
            email="bob.smith@example.com",
            phone="+1-555-0101"
        )
        with self.assertRaises(IntegrityError):
            Member.objects.create(
                member_code="MEM-TEST-002",
                first_name="Bob2",
                last_name="Smith2",
                email="bob.smith@example.com",
                phone="+1-555-0102"
            )


class MemberAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_members",
            email="admin_mem@library.com",
            password="adminpassword"
        )
        self.member = Member.objects.create(
            member_code="MEM-2026-0001",
            first_name="Grace",
            last_name="Hopper",
            email="grace.hopper@navy.mil",
            phone="+1-555-0155",
            address="Arlington, VA",
            membership_status="ACTIVE",
            max_borrow_limit=5
        )

    def test_unauthorized_member_access(self):
        response = self.client.get('/api/v1/members/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_member_crud_and_lookup(self):
        self.client.force_authenticate(user=self.admin)

        # Create member
        create_res = self.client.post('/api/v1/members/', {
            'first_name': 'Alan',
            'last_name': 'Turing',
            'email': 'alan.turing@bletchley.uk',
            'phone': '+44-20-7946-0912',
            'membership_status': 'ACTIVE',
            'max_borrow_limit': 5
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        new_member = create_res.json()
        member_id = new_member['id']
        member_code = new_member['member_code']
        self.assertTrue(member_code.startswith('MEM-'))
        self.assertTrue(new_member['can_borrow'])

        # Check Audit Log
        self.assertTrue(AuditLog.objects.filter(entity_type='Member', entity_id=member_code, action='CREATE').exists())

        # List members with search
        search_res = self.client.get('/api/v1/members/?search=Turing')
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertEqual(search_res.json()['count'], 1)

        # Lookup by member code
        lookup_res = self.client.get(f'/api/v1/members/lookup/?code={member_code}')
        self.assertEqual(lookup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(lookup_res.json()['full_name'], 'Alan Turing')

        # Lookup by QR code format
        qr_lookup_res = self.client.get(f'/api/v1/members/lookup/?qr=LMS:MEMBER:{member_code}')
        self.assertEqual(qr_lookup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(qr_lookup_res.json()['email'], 'alan.turing@bletchley.uk')

        # Member history endpoint
        history_res = self.client.get(f'/api/v1/members/{member_id}/history/')
        self.assertEqual(history_res.status_code, status.HTTP_200_OK)
        self.assertIn('borrowings', history_res.json())
        self.assertIn('fines', history_res.json())

        # Update member
        update_res = self.client.patch(f'/api/v1/members/{member_id}/', {
            'membership_status': 'SUSPENDED'
        }, format='json')
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.json()['membership_status'], 'SUSPENDED')

        # Delete member
        del_res = self.client.delete(f'/api/v1/members/{member_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(AuditLog.objects.filter(entity_type='Member', entity_id=member_code, action='DELETE').exists())

    def test_photo_upload_and_remove(self):
        self.client.force_authenticate(user=self.admin)
        photo = SimpleUploadedFile(
            'profile.png', b'fake-image-bytes', content_type='image/png'
        )
        up = self.client.post(
            f'/api/v1/members/{self.member.id}/photo/', {'photo': photo}, format='multipart'
        )
        self.assertEqual(up.status_code, status.HTTP_200_OK, up.content)
        self.assertIn('photo', up.json())
        self.assertTrue(up.json()['photo'])
        self.member.photo.delete(save=False)
        rm = self.client.delete(f'/api/v1/members/{self.member.id}/photo/')
        self.assertEqual(rm.status_code, status.HTTP_200_OK)
        self.assertIsNone(rm.json()['photo'])
