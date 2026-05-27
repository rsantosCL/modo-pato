import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def user_data():
    return {"email": "alice@example.com", "display_name": "Alice", "password": "s3cur3pass"}


@pytest.fixture
def existing_user(user_data):
    return User.objects.create_user(**user_data)


@pytest.mark.django_db
def test_signup(client, user_data):
    response = client.post("/v1/auth/signup/", user_data, content_type="application/json")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == user_data["email"]
    assert body["display_name"] == user_data["display_name"]
    assert "password" not in body


@pytest.mark.django_db
def test_signup_duplicate_email(client, user_data, existing_user):
    response = client.post("/v1/auth/signup/", user_data, content_type="application/json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_login(client, user_data, existing_user):
    response = client.post(
        "/v1/auth/login/",
        {"email": user_data["email"], "password": user_data["password"]},
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert "access" in body
    assert "refresh" in body


@pytest.mark.django_db
def test_login_wrong_password(client, existing_user):
    response = client.post(
        "/v1/auth/login/",
        {"email": existing_user.email, "password": "wrongpassword"},
        content_type="application/json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_signup_without_email_fails(db):
    with pytest.raises(ValueError, match="Email is required"):
        User.objects.create_user(email="", password="pass")


@pytest.mark.django_db
def test_refresh(client, user_data, existing_user):
    login = client.post(
        "/v1/auth/login/",
        {"email": user_data["email"], "password": user_data["password"]},
        content_type="application/json",
    )
    refresh_token = login.json()["refresh"]
    response = client.post("/v1/auth/refresh/", {"refresh": refresh_token}, content_type="application/json")
    assert response.status_code == 200
    assert "access" in response.json()
