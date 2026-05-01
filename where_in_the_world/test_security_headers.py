import pytest
from where_in_the_world_app import app

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def test_security_headers_present(client):
    response = client.get('/')
    assert response.status_code == 200

    headers = response.headers
    assert headers.get('X-Content-Type-Options') == 'nosniff'
    assert headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert headers.get('Strict-Transport-Security') == 'max-age=31536000; includeSubDomains'
    assert 'default-src \'self\'' in headers.get('Content-Security-Policy', '')
