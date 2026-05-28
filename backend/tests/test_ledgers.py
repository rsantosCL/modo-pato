import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from ledgers.models import Ledger, LedgerMember, InviteToken
from ledgers.enums import MemberRole

User = get_user_model()


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


# ── Ledger CRUD ──────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_create_ledger(auth_client, alice):
    c = auth_client(alice)
    response = c.post("/v1/ledgers/", {"name": "Familia", "kind": "shared"}, content_type="application/json")
    assert response.status_code == 201
    assert response.json()["name"] == "Familia"


@pytest.mark.django_db
def test_list_ledgers_only_own(auth_client, alice, bob, alice_ledger):
    bob_ledger = Ledger.objects.create(name="Bob solo", owner=bob)
    LedgerMember.objects.create(ledger=bob_ledger, user=bob, role=MemberRole.OWNER, joined_at=timezone.now())

    c = auth_client(alice)
    response = c.get("/v1/ledgers/")
    assert response.status_code == 200
    names = [l["name"] for l in response.json()]
    assert "Familia" in names
    assert "Bob solo" not in names


@pytest.mark.django_db
def test_get_ledger_as_member(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.get(f"/v1/ledgers/{alice_ledger.id}/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_get_ledger_not_member_returns_404(auth_client, bob, alice_ledger):
    c = auth_client(bob)
    response = c.get(f"/v1/ledgers/{alice_ledger.id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_patch_ledger_as_owner(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.patch(f"/v1/ledgers/{alice_ledger.id}/", {"name": "Updated"}, content_type="application/json")
    assert response.status_code == 200
    assert response.json()["name"] == "Updated"


@pytest.mark.django_db
def test_patch_ledger_as_viewer_forbidden(auth_client, bob, alice_ledger):
    LedgerMember.objects.create(ledger=alice_ledger, user=bob, role=MemberRole.VIEWER, joined_at=timezone.now())
    c = auth_client(bob)
    response = c.patch(f"/v1/ledgers/{alice_ledger.id}/", {"name": "Hacked"}, content_type="application/json")
    assert response.status_code == 403


# ── Invite flow ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_create_invite(auth_client, alice, alice_ledger):
    c = auth_client(alice)
    response = c.post(f"/v1/ledgers/{alice_ledger.id}/invites/", {"role": "editor"}, content_type="application/json")
    assert response.status_code == 201
    assert "token" in response.json()


@pytest.mark.django_db
def test_accept_invite(auth_client, alice, bob, alice_ledger):
    invite = InviteToken.objects.create(ledger=alice_ledger, created_by=alice, role=MemberRole.EDITOR)

    c = auth_client(bob)
    response = c.post(f"/v1/invites/{invite.token}/accept/", content_type="application/json")
    assert response.status_code == 200
    assert LedgerMember.objects.filter(ledger=alice_ledger, user=bob).exists()


@pytest.mark.django_db
def test_accept_invite_idempotent_if_already_member(auth_client, alice, bob, alice_ledger):
    LedgerMember.objects.create(ledger=alice_ledger, user=bob, role=MemberRole.EDITOR, joined_at=timezone.now())
    invite = InviteToken.objects.create(ledger=alice_ledger, created_by=alice, role=MemberRole.EDITOR)

    c = auth_client(bob)
    response = c.post(f"/v1/invites/{invite.token}/accept/", content_type="application/json")
    assert response.status_code == 200


@pytest.mark.django_db
def test_accept_invalid_token(auth_client, bob):
    c = auth_client(bob)
    response = c.post("/v1/invites/bad-token/accept/", content_type="application/json")
    assert response.status_code == 404


@pytest.mark.django_db
def test_get_invite_detail(auth_client, alice, bob, alice_ledger):
    invite = InviteToken.objects.create(ledger=alice_ledger, created_by=alice, role=MemberRole.EDITOR)
    c = auth_client(bob)
    response = c.get(f"/v1/invites/{invite.token}/")
    assert response.status_code == 200
    data = response.json()
    assert data["ledger_name"] == alice_ledger.name
    assert data["role"] == MemberRole.EDITOR
    assert data["invited_by"] == alice.display_name
    assert data["ledger_id"] == str(alice_ledger.id)


@pytest.mark.django_db
def test_get_invite_detail_invalid_token(auth_client, bob):
    c = auth_client(bob)
    response = c.get("/v1/invites/bad-token/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_get_invite_detail_already_accepted(auth_client, alice, bob, alice_ledger):
    invite = InviteToken.objects.create(
        ledger=alice_ledger, created_by=alice, role=MemberRole.EDITOR,
        accepted_by=bob, accepted_at=timezone.now(),
    )
    c = auth_client(bob)
    response = c.get(f"/v1/invites/{invite.token}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_get_invite_detail_requires_auth(client, alice, alice_ledger):
    invite = InviteToken.objects.create(ledger=alice_ledger, created_by=alice, role=MemberRole.EDITOR)
    response = client.get(f"/v1/invites/{invite.token}/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_members_as_non_member_forbidden(auth_client, bob, alice_ledger):
    c = auth_client(bob)
    response = c.get(f"/v1/ledgers/{alice_ledger.id}/members/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_viewer_cannot_create_invite(auth_client, bob, alice_ledger):
    LedgerMember.objects.create(ledger=alice_ledger, user=bob, role=MemberRole.VIEWER, joined_at=timezone.now())
    c = auth_client(bob)
    response = c.post(f"/v1/ledgers/{alice_ledger.id}/invites/", {"role": "editor"}, content_type="application/json")
    assert response.status_code == 403
