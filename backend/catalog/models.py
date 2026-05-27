from django.conf import settings
from django.db import models

from core.fields import MonthListField
from core.models import UUIDModel
from .enums import ItemCategory, ItemFrequency, PaymentSource, CurrencyType


class CatalogItem(UUIDModel):
    ledger = models.ForeignKey(
        "ledgers.Ledger",
        on_delete=models.CASCADE,
        related_name="catalog_items",
    )
    category = models.CharField(max_length=10, choices=ItemCategory.choices)
    name = models.CharField(max_length=200)
    currency = models.CharField(max_length=3, choices=CurrencyType.choices)
    frequency = models.CharField(max_length=6, choices=ItemFrequency.choices)
    custom_months = MonthListField(null=True, blank=True)
    start_month = models.DateField()
    total_installments = models.PositiveIntegerField(null=True, blank=True)
    payoff_month = models.DateField(null=True, blank=True)
    is_saving = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.ledger})"


class CatalogItemRevision(UUIDModel):
    catalog_item = models.ForeignKey(
        CatalogItem,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    effective_from_month = models.DateField()
    amount_real = models.DecimalField(max_digits=16, decimal_places=4)
    payment_source = models.CharField(max_length=11, choices=PaymentSource.choices)
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="catalog_revisions",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["catalog_item", "effective_from_month"],
                name="unique_revision_per_month",
            )
        ]
        ordering = ["effective_from_month"]

    def __str__(self):
        return f"{self.catalog_item.name} @ {self.effective_from_month}"
