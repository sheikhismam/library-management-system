from rest_framework import serializers
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = [
            'id', 'book', 'member', 'reviewer_name',
            'rating', 'comment', 'is_approved',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value

    def validate(self, data):
        book = data.get('book')
        reviewer_name = data.get('reviewer_name')

        if not book:
            raise serializers.ValidationError('Book is required.')

        if not reviewer_name:
            raise serializers.ValidationError('Reviewer name is required.')

        return data