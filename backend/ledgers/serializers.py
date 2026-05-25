from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Ledger, LedgerMember, InviteToken

User = get_user_model()


class LedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ledger
        fields = ("id", "name", "kind", "created_at", "archived_at")
        read_only_fields = ("id", "created_at", "archived_at")


class LedgerMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    display_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = LedgerMember
        fields = ("user_id", "email", "display_name", "role", "invited_at", "joined_at")
        read_only_fields = fields


class InviteTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = InviteToken
        fields = ("id", "token", "role", "created_at")
        read_only_fields = fields


class InviteCreateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=LedgerMember.Role.choices, default=LedgerMember.Role.EDITOR)
