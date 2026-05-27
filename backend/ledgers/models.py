from django.conf import settings
from django.db import models

from core.models import UUIDModel
from core.tokens import generate_token
from .enums import LedgerKind, MemberRole


class Ledger(UUIDModel):
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_ledgers",
    )
    kind = models.CharField(max_length=10, choices=LedgerKind.choices, default=LedgerKind.PERSONAL)
    created_at = models.DateTimeField(auto_now_add=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

    def membership_for(self, user) -> "LedgerMember | None":
        try:
            return self.members.get(user=user)
        except LedgerMember.DoesNotExist:
            return None

    def can_edit(self, user) -> bool:
        membership = self.membership_for(user)
        return membership is not None and membership.role in (MemberRole.OWNER, MemberRole.EDITOR)

    @classmethod
    def get_for_member(cls, pk, user) -> "Ledger | None":
        try:
            ledger = cls.objects.get(pk=pk)
        except cls.DoesNotExist:
            return None
        if ledger.membership_for(user) is None:
            return None
        return ledger


class LedgerMember(models.Model):
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ledger_memberships",
    )
    role = models.CharField(max_length=10, choices=MemberRole.choices)
    invited_at = models.DateTimeField(auto_now_add=True)
    joined_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("ledger", "user")

    def __str__(self):
        return f"{self.user} — {self.ledger} ({self.role})"


class InviteToken(UUIDModel):
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name="invites")
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    role = models.CharField(max_length=10, choices=MemberRole.choices, default=MemberRole.EDITOR)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_invites",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accepted_invites",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Invite to {self.ledger} ({self.role})"
