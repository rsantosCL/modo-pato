from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from .enums import MemberRole
from .models import Ledger


class IsMember(BasePermission):
    def has_object_permission(self, request: Request, view: APIView, obj: Ledger) -> bool:
        return obj.membership_for(request.user) is not None


class IsOwnerOrEditor(BasePermission):
    def has_object_permission(self, request: Request, view: APIView, obj: Ledger) -> bool:
        membership = obj.membership_for(request.user)
        return membership is not None and membership.role in (MemberRole.OWNER, MemberRole.EDITOR)
