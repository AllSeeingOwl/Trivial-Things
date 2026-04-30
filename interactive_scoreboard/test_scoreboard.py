import os
import tempfile
import pytest
import json
from scoreboard_app import app, db, ScoreEntry

@pytest.fixture
def client():
    db_fd, db_path = tempfile.mkstemp()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client

    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture(autouse=True)
def clean_db(client):
    with app.app_context():
        db.session.query(ScoreEntry).delete()
        db.session.commit()

def test_empty_db(client):
    """Start with a blank database."""
    rv = client.get('/api/scores')
    assert rv.status_code == 200
    assert json.loads(rv.data) == []

def test_add_score(client):
    """Test adding a new score."""
    post_data = {
        'player_name': 'Alice',
        'score': 150,
        'time_taken': 45.5,
        'avatar_url': 'http://example.com/alice.png'
    }
    rv = client.post('/api/scores', json=post_data)
    assert rv.status_code == 201

    data = json.loads(rv.data)
    assert data['player_name'] == 'Alice'
    assert data['score'] == 150
    assert data['time_taken'] == 45.5
    assert data['avatar_url'] == 'http://example.com/alice.png'

def test_add_score_invalid(client):
    """Test missing data returns 400."""
    rv = client.post('/api/scores', json={'player_name': 'Bob'})
    assert rv.status_code == 400

def test_get_scores_ranking(client):
    """Test scores are returned in descending order."""
    client.post('/api/scores', json={'player_name': 'Bob', 'score': 100})
    client.post('/api/scores', json={'player_name': 'Alice', 'score': 150})
    client.post('/api/scores', json={'player_name': 'Charlie', 'score': 50})

    rv = client.get('/api/scores')
    data = json.loads(rv.data)

    assert len(data) == 3
    assert data[0]['player_name'] == 'Alice'
    assert data[1]['player_name'] == 'Bob'
    assert data[2]['player_name'] == 'Charlie'

def test_get_stats(client):
    """Test statistics calculation."""
    client.post('/api/scores', json={'player_name': 'Alice', 'score': 100})
    client.post('/api/scores', json={'player_name': 'Alice', 'score': 200})
    client.post('/api/scores', json={'player_name': 'Bob', 'score': 50})

    rv = client.get('/api/stats')
    data = json.loads(rv.data)

    assert len(data) == 2

    # Find Alice's stats
    alice_stats = next(s for s in data if s['player_name'] == 'Alice')
    assert alice_stats['games_played'] == 2
    assert alice_stats['high_score'] == 200
    assert alice_stats['average_score'] == 150.0

    # Find Bob's stats
    bob_stats = next(s for s in data if s['player_name'] == 'Bob')
    assert bob_stats['games_played'] == 1
    assert bob_stats['high_score'] == 50

def test_export_csv(client):
    """Test CSV export."""
    client.post('/api/scores', json={'player_name': 'Alice', 'score': 100})

    rv = client.get('/api/export')
    assert rv.status_code == 200
    assert rv.headers['Content-Type'] == 'text/csv; charset=utf-8'

    # Check basic CSV contents
    csv_data = rv.data.decode('utf-8')
    assert 'Player Name,Score' in csv_data
    assert 'Alice,100' in csv_data
