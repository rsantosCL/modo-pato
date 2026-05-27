from django.db import IntegrityError
from rest_framework import generics
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from ledgers.models import Ledger
from .models import CatalogItem, CatalogItemRevision
from .permissions import CanEditCatalogItem
from .serializers import CatalogItemSerializer, CatalogItemCreateSerializer, CatalogItemRevisionSerializer


class CatalogItemListCreateView(generics.ListCreateAPIView):

    def _get_ledger(self):
        ledger = Ledger.get_for_member(self.kwargs["ledger_pk"], self.request.user)
        if ledger is None:
            raise NotFound
        return ledger

    def get_queryset(self):
        return CatalogItem.objects.filter(
            ledger=self._get_ledger()
        ).prefetch_related("revisions").order_by("category", "name")

    def get_serializer_class(self):
        return CatalogItemCreateSerializer if self.request.method == "POST" else CatalogItemSerializer

    def perform_create(self, serializer):
        ledger = self._get_ledger()
        if not ledger.can_edit(self.request.user):
            raise PermissionDenied
        serializer.save(ledger=ledger)


class CatalogItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CatalogItemSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return CatalogItem.objects.filter(
            ledger__members__user=self.request.user
        ).prefetch_related("revisions")

    def get_permissions(self):
        if self.request.method in ("PATCH", "DELETE"):
            return [CanEditCatalogItem()]
        return super().get_permissions()


class CatalogItemRevisionListCreateView(generics.ListCreateAPIView):
    serializer_class = CatalogItemRevisionSerializer

    def _get_item(self):
        try:
            item = CatalogItem.objects.select_related("ledger").get(pk=self.kwargs["item_pk"])
        except CatalogItem.DoesNotExist:
            raise NotFound
        if item.ledger.membership_for(self.request.user) is None:
            raise NotFound
        return item

    def get_queryset(self):
        return CatalogItemRevision.objects.filter(
            catalog_item=self._get_item()
        ).order_by("effective_from_month")

    def perform_create(self, serializer):
        item = self._get_item()
        if not item.ledger.can_edit(self.request.user):
            raise PermissionDenied
        try:
            serializer.save(catalog_item=item, created_by=self.request.user)
        except IntegrityError:
            raise ValidationError({"effective_from_month": "A revision for this month already exists."})
