import calendar

from django.db import IntegrityError
from rest_framework import serializers

from .derived import DerivedFields
from .enums import ItemCategory, PaymentSource
from .models import CatalogItem, CatalogItemRevision


class CatalogItemRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogItemRevision
        fields = ("id", "effective_from_month", "amount_real", "payment_source", "note", "created_at", "created_by_id")
        read_only_fields = ("id", "created_at", "created_by_id")

    def validate_effective_from_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Must be the first day of the month.")
        return value


class CatalogItemSerializer(serializers.ModelSerializer):
    revisions = CatalogItemRevisionSerializer(many=True, read_only=True)
    valid_months = serializers.SerializerMethodField()
    end_month = serializers.SerializerMethodField()
    prepaid_installments = serializers.SerializerMethodField()

    class Meta:
        model = CatalogItem
        fields = (
            "id", "ledger_id", "category", "name", "currency", "frequency",
            "custom_months", "start_month", "total_installments", "payoff_month",
            "is_saving", "created_at", "updated_at",
            "revisions", "valid_months", "end_month", "prepaid_installments",
        )
        read_only_fields = ("id", "ledger_id", "currency", "created_at", "updated_at")

    def get_valid_months(self, obj) -> list[int]:
        return [m.value for m in DerivedFields.valid_months(obj.frequency, obj.start_month, obj.custom_months)]

    def get_end_month(self, obj) -> str | None:
        result = DerivedFields.end_month(obj.start_month, obj.frequency, obj.custom_months, obj.total_installments)
        return result.isoformat() if result else None

    def get_prepaid_installments(self, obj) -> int:
        return DerivedFields.prepaid_installments(obj.start_month, obj.frequency, obj.custom_months, obj.payoff_month)

    def validate_start_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Must be the first day of the month.")
        return value

    def validate_payoff_month(self, value):
        if value is not None and value.day != 1:
            raise serializers.ValidationError("Must be the first day of the month.")
        return value

    def validate(self, data):
        # Reject currency changes after creation
        if self.instance is not None and "currency" in self.initial_data:
            raise serializers.ValidationError({"currency": "Currency cannot be changed after creation."})

        frequency = data.get("frequency", getattr(self.instance, "frequency", None))
        custom_months = data.get("custom_months", getattr(self.instance, "custom_months", None))
        start_month = data.get("start_month", getattr(self.instance, "start_month", None))
        total_installments = data.get("total_installments", getattr(self.instance, "total_installments", None))
        payoff_month = data.get("payoff_month", getattr(self.instance, "payoff_month", None))

        # frequency / custom_months consistency
        if frequency == "CUSTOM":
            if not custom_months:
                raise serializers.ValidationError({"custom_months": "Required for CUSTOM frequency."})
            invalid = [m for m in custom_months if not (1 <= int(m) <= 12)]
            if invalid:
                raise serializers.ValidationError({"custom_months": "All values must be in range 1–12."})
        else:
            if custom_months:
                raise serializers.ValidationError({"custom_months": "Must be null for non-CUSTOM frequency."})

        # total_installments
        if total_installments is not None and total_installments < 1:
            raise serializers.ValidationError({"total_installments": "Must be >= 1 or null."})

        # income category is immutable in both directions
        if self.instance is not None:
            new_category = data.get("category")
            if new_category is not None and new_category != self.instance.category:
                if self.instance.category == ItemCategory.INCOME:
                    raise serializers.ValidationError({"category": "Income items cannot change category."})
                if new_category == ItemCategory.INCOME:
                    raise serializers.ValidationError({"category": "Cannot change category to income."})

        # income items cannot have a payoff month
        category = data.get("category", getattr(self.instance, "category", None))
        if category == ItemCategory.INCOME and payoff_month is not None:
            raise serializers.ValidationError({"payoff_month": "Income items cannot have a payoff month."})

        # payoff_month cross-field checks
        if payoff_month is not None and start_month is not None:
            if payoff_month < start_month:
                raise serializers.ValidationError({"payoff_month": "Must be >= start_month."})

            vm = DerivedFields.valid_months(frequency, start_month, custom_months or [])
            if calendar.Month(payoff_month.month) not in vm:
                raise serializers.ValidationError({"payoff_month": "Must fall on a valid month for this item's frequency."})

            end = DerivedFields.end_month(start_month, frequency, custom_months, total_installments)
            if end is not None and payoff_month > end:
                raise serializers.ValidationError({"payoff_month": "Must be <= end_month."})

        return data


class CatalogItemCreateSerializer(CatalogItemSerializer):
    first_revision = CatalogItemRevisionSerializer(write_only=True)

    class Meta(CatalogItemSerializer.Meta):
        fields = CatalogItemSerializer.Meta.fields + ("first_revision",)
        read_only_fields = ("id", "ledger_id", "created_at", "updated_at")  # currency writable on create

    def validate(self, data):
        data = super().validate(data)
        first_revision = data.get("first_revision", {})
        start_month = data.get("start_month")
        rev_month = first_revision.get("effective_from_month")
        if start_month and rev_month and rev_month > start_month:
            raise serializers.ValidationError(
                {"first_revision": {"effective_from_month": "Must be <= start_month."}}
            )
        if data.get("category") == ItemCategory.INCOME and first_revision.get("payment_source") != PaymentSource.CASH:
            raise serializers.ValidationError(
                {"first_revision": {"payment_source": "Income items must use Cash."}}
            )
        return data

    def create(self, validated_data):
        first_revision_data = validated_data.pop("first_revision")
        ledger = validated_data.pop("ledger")
        try:
            item = CatalogItem.objects.create(ledger=ledger, **validated_data)
            CatalogItemRevision.objects.create(
                catalog_item=item,
                created_by=self.context["request"].user,
                **first_revision_data,
            )
        except IntegrityError:
            raise serializers.ValidationError(
                {"first_revision": {"effective_from_month": "A revision for this month already exists."}}
            )
        return item
