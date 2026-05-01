import pytest
from where_in_the_world_app import app as flask_app, haversine_distance, parse_coordinates
import where_in_the_world_app as app_module

@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        yield client

def test_parse_coordinates():
    text = "///punctuate.gently.taster\n51.694548, -2.029684\n51°41.6729'N, 2°1.7810'W"
    lat, lng = parse_coordinates(text)
    assert lat == 51.694548
    assert lng == -2.029684

def test_haversine_distance():
    dist = haversine_distance(51.5074, -0.1278, 48.8566, 2.3522)
    assert 210 < dist < 220

def test_get_questions(client, monkeypatch):
    mock_questions = [
        {"id": "1", "prompt": "P1", "lat": 1.0, "lng": 2.0, "place": "L1"},
        {"id": "2", "prompt": "P2", "lat": 1.0, "lng": 2.0, "place": "L2"},
        {"id": "3", "prompt": "P3", "lat": 1.0, "lng": 2.0, "place": "L3"},
    ]
    monkeypatch.setattr(app_module, 'QUESTIONS', mock_questions)
    response = client.get('/api/questions?count=3')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3
    for q in data:
        assert 'lat' not in q  # Cheating prevention
        assert 'id' in q
        assert 'prompt' in q
