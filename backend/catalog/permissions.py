from rest_framework.permissions import BasePermission


class IsCatalogItemMember(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.ledger.membership_for(request.user) is not None


class CanEditCatalogItem(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.ledger.can_edit(request.user)
