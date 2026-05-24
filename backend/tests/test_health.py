import pytest
from django.test import Client


@pytest.fixture
def client():
    return Client()


def test_health(client):
    response = client.get("/v1/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
