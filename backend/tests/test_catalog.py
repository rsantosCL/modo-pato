import calendar
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from catalog.derived import DerivedFields
from catalog.enums import ItemCategory, ItemFrequency, PaymentSource, CurrencyType
from catalog.models import CatalogItem, CatalogItemRevision
from ledgers.enums import MemberRole
from ledgers.models import Ledger, LedgerMember

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def alice(db):
    return User.objects.create_user(email="alice@example.com", display_name="Alice", password="pass")


@pytest.fixture
def bob(db):
    return User.objects.create_user(email="bob@example.com", display_name="Bob", password="pass")


@pytest.fixture
def auth_client(client):
    def _auth(user):
        response = client.post(
            "/v1/auth/login/",
            {"email": user.email, "password": "pass"},
            content_type="application/json",
        )
        token = response.json()["access"]
        client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return client
    return _auth


@pytest.fixture
def alice_ledger(alice):
    ledger = Ledger.objects.create(name="Familia", owner=alice)
    LedgerMember.objects.create(ledger=ledger, user=alice, role=MemberRole.OWNER, joined_at=timezone.now())
    return ledger


@pytest.fixture
def salary_item(alice_ledger, alice):
    """Appendix B — Salary: income, CLP, monthly, 24 installments, two revisions."""
    item = CatalogItem.objects.create(
        ledger=alice_ledger,
        category=ItemCategory.INCOME,
        name="Salary",
        currency=CurrencyType.CLP,
        frequency=ItemFrequency.MONTHLY,
        start_month=date(2025, 3, 1),
        total_installments=24,
    )
    CatalogItemRevision.objects.create(
        catalog_item=item,
        effective_from_month=date(2025, 3, 1),
        amount_real="7450000.0000",
        payment_source=PaymentSource.CASH,
        created_by=alice,
    )
    CatalogItemRevision.objects.create(
        catalog_item=item,
        effective_from_month=date(2026, 3, 1),
        amount_real="7750000.0000",
        payment_source=PaymentSource.CASH,
        note="Aumento 2026",
        created_by=alice,
    )
    return item


# ── DerivedFields unit tests ──────────────────────────────────────────────────

class TestDerivedFields:

    def test_valid_months_monthly(self):
        vm = DerivedFields.valid_months(ItemFrequency.MONTHLY, date(2025, 3, 1), None)
        assert vm == [calendar.Month(i) for i in range(1, 13)]

    def test_valid_months_quarterly_march_start(self):
        vm = DerivedFields.valid_months(ItemFrequency.QUARTERLY, date(2025, 3, 1), None)
        assert sorted(vm) == [calendar.Month(m) for m in [3, 6, 9, 12]]

    def test_valid_months_half_yearly(self):
        vm = DerivedFields.valid_months(ItemFrequency.HALF_YEARLY, date(2025, 3, 1), None)
        assert vm == [calendar.Month(3), calendar.Month(9)]

    def test_valid_months_yearly(self):
        vm = DerivedFields.valid_months(ItemFrequency.YEARLY, date(2025, 3, 1), None)
        assert vm == [calendar.Month(3)]

    def test_valid_months_custom(self):
        months = [calendar.Month(m) for m in [1, 4, 7, 10]]
        vm = DerivedFields.valid_months(ItemFrequency.CUSTOM, date(2025, 1, 1), months)
        assert vm == months

    def test_end_month_infinite(self):
        assert DerivedFields.end_month(date(2025, 3, 1), ItemFrequency.MONTHLY, None, None) is None

    def test_end_month_appendix_b_salary(self):
        result = DerivedFields.end_month(date(2025, 3, 1), ItemFrequency.MONTHLY, None, 24)
        assert result == date(2027, 2, 1)

    def test_end_month_yearly(self):
        result = DerivedFields.end_month(date(2025, 3, 1), ItemFrequency.YEARLY, None, 3)
        assert result == date(2027, 3, 1)

    def test_end_month_quarterly(self):
        result = DerivedFields.end_month(date(2025, 3, 1), ItemFrequency.QUARTERLY, None, 4)
        assert result == date(2025, 12, 1)

    def test_prepaid_installments_no_payoff(self):
        assert DerivedFields.prepaid_installments(date(2025, 3, 1), ItemFrequency.MONTHLY, None, None) == 0

    def test_prepaid_installments_monthly(self):
        # 6 months from 2025-03 (incl) to 2025-09 (excl)
        result = DerivedFields.prepaid_installments(
            date(2025, 3, 1), ItemFrequency.MONTHLY, None, date(2025, 9, 1)
        )
        assert result == 6

    def test_prepaid_installments_at_start(self):
        # payoff at start_month → 0 prepaid
        result = DerivedFields.prepaid_installments(
            date(2025, 3, 1), ItemFrequency.YEARLY, None, date(2025, 3, 1)
        )
        assert result == 0


# ── Catalog item CRUD + permissions ──────────────────────────────────────────

def _item_payload(**overrides):
    payload = {
        "name": "Test Item",
        "category": "variable",
        "currency": "CLP",
        "frequency": "M",
        "start_month": "2025-01-01",
        "first_revision": {
            "effective_from_month": "2025-01-01",
            "amount_real": "1000.0000",
            "payment_source": "CASH",
        },
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_create_catalog_item(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(name="Combustible"),
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Combustible"
    assert CatalogItemRevision.objects.filter(catalog_item__name="Combustible").count() == 1


@pytest.mark.django_db
def test_list_catalog_items(auth_client, alice, alice_ledger, salary_item):
    c = auth_client(alice)
    response = c.get(f"/v1/ledgers/{alice_ledger.id}/catalog-items/")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.django_db
def test_viewer_cannot_create_item(auth_client, bob, alice_ledger):
    LedgerMember.objects.create(ledger=alice_ledger, user=bob, role=MemberRole.VIEWER, joined_at=timezone.now())
    c = auth_client(bob)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(),
        content_type="application/json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_non_member_cannot_list_items(auth_client, bob, alice_ledger):
    c = auth_client(bob)
    response = c.get(f"/v1/ledgers/{alice_ledger.id}/catalog-items/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_patch_item_name(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.patch(
        f"/v1/catalog-items/{salary_item.id}/",
        {"name": "Base Salary"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Base Salary"


@pytest.mark.django_db
def test_viewer_cannot_patch_item(auth_client, bob, alice_ledger, salary_item):
    LedgerMember.objects.create(ledger=alice_ledger, user=bob, role=MemberRole.VIEWER, joined_at=timezone.now())
    c = auth_client(bob)
    response = c.patch(
        f"/v1/catalog-items/{salary_item.id}/",
        {"name": "Hacked"},
        content_type="application/json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_delete_item(auth_client, alice, alice_ledger, salary_item):
    c = auth_client(alice)
    response = c.delete(f"/v1/catalog-items/{salary_item.id}/")
    assert response.status_code == 204
    assert not CatalogItem.objects.filter(id=salary_item.id).exists()


@pytest.mark.django_db
def test_currency_cannot_change_after_creation(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.patch(
        f"/v1/catalog-items/{salary_item.id}/",
        {"currency": "USD"},
        content_type="application/json",
    )
    assert response.status_code == 400


# ── Revision CRUD ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_revisions(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.get(f"/v1/catalog-items/{salary_item.id}/revisions/")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.django_db
def test_create_revision(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.post(
        f"/v1/catalog-items/{salary_item.id}/revisions/",
        {"effective_from_month": "2027-03-01", "amount_real": "8050000.0000", "payment_source": "CASH", "note": "Aumento 2027"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert CatalogItemRevision.objects.filter(catalog_item=salary_item).count() == 3


@pytest.mark.django_db
def test_duplicate_revision_month_rejected(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.post(
        f"/v1/catalog-items/{salary_item.id}/revisions/",
        {"effective_from_month": "2025-03-01", "amount_real": "999.0000", "payment_source": "CASH"},
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_revision_effective_month_must_be_first_of_month(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.post(
        f"/v1/catalog-items/{salary_item.id}/revisions/",
        {"effective_from_month": "2027-03-15", "amount_real": "8000.0000", "payment_source": "CASH"},
        content_type="application/json",
    )
    assert response.status_code == 400


# ── §13.3 validation rules ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_start_month_must_be_first_of_month(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(start_month="2025-01-15"),
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_total_installments_zero_rejected(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(total_installments=0),
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_total_installments_null_allowed(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(total_installments=None),
        content_type="application/json",
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_custom_frequency_requires_custom_months(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(frequency="CUSTOM"),
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_non_custom_frequency_rejects_custom_months(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        _item_payload(frequency="M", custom_months=[1, 3, 5]),
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_custom_frequency_with_valid_months(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    payload = _item_payload(frequency="CUSTOM", custom_months=[1, 4, 7, 10])
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        payload,
        content_type="application/json",
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_payoff_month_before_start_rejected(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    payload = _item_payload(start_month="2025-03-01", payoff_month="2025-01-01")
    payload["first_revision"]["effective_from_month"] = "2025-03-01"
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        payload,
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_payoff_month_after_end_month_rejected(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    payload = _item_payload(
        frequency="Y", start_month="2025-03-01",
        total_installments=3, payoff_month="2028-03-01",
    )
    payload["first_revision"]["effective_from_month"] = "2025-03-01"
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        payload,
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_payoff_month_must_fall_on_valid_month(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    # Yearly starting March; April is not a valid month
    payload = _item_payload(frequency="Y", start_month="2025-03-01", payoff_month="2026-04-01")
    payload["first_revision"]["effective_from_month"] = "2025-03-01"
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        payload,
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_first_revision_must_cover_start_month(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    payload = _item_payload(start_month="2025-01-01")
    payload["first_revision"]["effective_from_month"] = "2025-03-01"
    response = c.post(
        f"/v1/ledgers/{alice_ledger.id}/catalog-items/",
        payload,
        content_type="application/json",
    )
    assert response.status_code == 400


# ── Derived fields in API response (Appendix B) ───────────────────────────────

@pytest.mark.django_db
def test_appendix_b_salary_derived_fields(auth_client, alice, salary_item):
    c = auth_client(alice)
    response = c.get(f"/v1/catalog-items/{salary_item.id}/")
    assert response.status_code == 200
    data = response.json()
    assert data["valid_months"] == list(range(1, 13))
    assert data["end_month"] == "2027-02-01"
    assert data["prepaid_installments"] == 0
    assert len(data["revisions"]) == 2


@pytest.mark.django_db
def test_yearly_item_derived_fields(auth_client, alice, alice_ledger):
    item = CatalogItem.objects.create(
        ledger=alice_ledger,
        category=ItemCategory.ESSENTIAL,
        name="Permiso circulación",
        currency=CurrencyType.CLP,
        frequency=ItemFrequency.YEARLY,
        start_month=date(2025, 3, 1),
    )
    CatalogItemRevision.objects.create(
        catalog_item=item, effective_from_month=date(2025, 3, 1),
        amount_real="230000.0000", payment_source=PaymentSource.CASH, created_by=alice,
    )
    c = auth_client(alice)
    response = c.get(f"/v1/catalog-items/{item.id}/")
    data = response.json()
    assert data["valid_months"] == [3]
    assert data["end_month"] is None
    assert data["prepaid_installments"] == 0
