import os
import tempfile
import json
import pytest
from quarterly_calendar_app import app, db, Event

@pytest.fixture
def client():
    db_fd, db_path = tempfile.mkstemp()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client

    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture(autouse=True)
def clean_db(client):
    with app.app_context():
        db.session.query(Event).delete()
        db.session.commit()

def test_security_headers(client):
    """Test security response headers."""
    rv = client.get('/')
    assert rv.status_code == 200
    assert rv.headers.get('X-Content-Type-Options') == 'nosniff'
    assert rv.headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert 'max-age=31536000' in rv.headers.get('Strict-Transport-Security', '')
    assert "default-src 'self'" in rv.headers.get('Content-Security-Policy', '')
    assert "https://cdn.tailwindcss.com" in rv.headers.get('Content-Security-Policy', '')

def test_get_events_empty(client):
    """Test fetching events when database is empty."""
    rv = client.get('/api/events')
    assert rv.status_code == 200
    assert json.loads(rv.data) == []

def test_create_event_success(client):
    """Test successful event creation."""
    payload = {
        'title': 'World Cup Final',
        'start_date': '2026-07-15',
        'end_date': '2026-07-15',
        'category': 'Sporting',
        'is_tentative': False
    }
    rv = client.post('/api/events', json=payload)
    assert rv.status_code == 201
    data = json.loads(rv.data)
    assert data['title'] == 'World Cup Final'
    assert data['category'] == 'Sporting'
    assert data['is_tentative'] is False

def test_create_event_validation(client):
    """Test input validation logic for event creation."""
    # 1. Missing body
    rv = client.post('/api/events', json=None)
    assert rv.status_code == 400

    # 2. Non-dict payload (list)
    rv = client.post('/api/events', json=['title', 'Sporting'])
    assert rv.status_code == 400

    # 3. Missing required fields
    rv = client.post('/api/events', json={'title': 'Test Event'})
    assert rv.status_code == 400

    # 4. Oversized title (>100 chars)
    rv = client.post('/api/events', json={
        'title': 'A' * 101,
        'start_date': '2026-07-15',
        'end_date': '2026-07-15',
        'category': 'Sporting'
    })
    assert rv.status_code == 400

    # 5. Oversized category (>50 chars)
    rv = client.post('/api/events', json={
        'title': 'Test Event',
        'start_date': '2026-07-15',
        'end_date': '2026-07-15',
        'category': 'B' * 51
    })
    assert rv.status_code == 400

    # 6. Invalid date format
    rv = client.post('/api/events', json={
        'title': 'Test Event',
        'start_date': '07/15/2026',
        'end_date': '2026-07-15',
        'category': 'Sporting'
    })
    assert rv.status_code == 400

    # 7. End date before start date
    rv = client.post('/api/events', json={
        'title': 'Test Event',
        'start_date': '2026-07-15',
        'end_date': '2026-07-10',
        'category': 'Sporting'
    })
    assert rv.status_code == 400

def test_delete_event(client):
    """Test deleting an existing event."""
    payload = {
        'title': 'Concert',
        'start_date': '2026-08-01',
        'end_date': '2026-08-01',
        'category': 'Cultural'
    }
    create_rv = client.post('/api/events', json=payload)
    event_id = json.loads(create_rv.data)['id']

    delete_rv = client.delete(f'/api/events/{event_id}')
    assert delete_rv.status_code == 204

    get_rv = client.get('/api/events')
    assert json.loads(get_rv.data) == []
