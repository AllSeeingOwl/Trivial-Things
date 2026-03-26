import pytest
from app import app, haversine_distance, parse_coordinates

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_parse_coordinates():
    text = "///punctuate.gently.taster\n51.694548, -2.029684\n51°41.6729'N, 2°1.7810'W"
    lat, lng = parse_coordinates(text)
    assert lat == 51.694548
    assert lng == -2.029684

def test_haversine_distance():
    # London (51.5074, -0.1278) to Paris (48.8566, 2.3522)
    # Approx 214 miles
    dist = haversine_distance(51.5074, -0.1278, 48.8566, 2.3522)
    assert 210 < dist < 220

def test_get_questions(client):
    response = client.get('/api/questions?count=3')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3
    for q in data:
        assert 'lat' not in q  # Cheating prevention
        assert 'id' in q
        assert 'prompt' in q
