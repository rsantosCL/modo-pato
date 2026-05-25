from django.contrib import admin
from .models import Ledger, LedgerMember, InviteToken


@admin.register(Ledger)
class LedgerAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "kind", "created_at", "archived_at")
    search_fields = ("name",)


@admin.register(LedgerMember)
class LedgerMemberAdmin(admin.ModelAdmin):
    list_display = ("ledger", "user", "role", "invited_at", "joined_at")


@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display = ("ledger", "role", "created_by", "created_at", "accepted_by", "accepted_at")
