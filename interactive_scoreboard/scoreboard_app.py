import os
import csv
from io import StringIO
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template, Response
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# Configure from environment variables
PORT = int(os.environ.get('PORT', 5000))
HOST = os.environ.get('HOST', '0.0.0.0')

# Default to a local SQLite database if not specified
basedir = os.path.abspath(os.path.dirname(__file__))
default_db_uri = 'sqlite:///' + os.path.join(basedir, 'scoreboard.db')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URI', default_db_uri)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class ScoreEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_name = db.Column(db.String(100), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    time_taken = db.Column(db.Float, nullable=True) # Time taken in seconds, optional
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    avatar_url = db.Column(db.String(255), nullable=True) # Optional avatar

    def to_dict(self):
        return {
            'id': self.id,
            'player_name': self.player_name,
            'score': self.score,
            'time_taken': self.time_taken,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'avatar_url': self.avatar_url
        }

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/scores', methods=['GET'])
def get_scores():
    # Rank entries by score descending.
    # We sort by time_taken.asc(), but we need to ensure NULLs come last in SQLite when using asc()
    # Using nulls_last() requires sqlalchemy 1.4+, which we have (2.0.49).
    scores = ScoreEntry.query.order_by(
        ScoreEntry.score.desc(),
        db.nulls_last(ScoreEntry.time_taken.asc())
    ).all()
    return jsonify([score.to_dict() for score in scores])

@app.route('/api/scores', methods=['POST'])
def add_score():
    data = request.json

    if not data or 'player_name' not in data or 'score' not in data:
        return jsonify({'error': 'Missing player_name or score'}), 400

    try:
        new_entry = ScoreEntry(
            player_name=data['player_name'],
            score=int(data['score']),
            time_taken=float(data['time_taken']) if 'time_taken' in data and data['time_taken'] else None,
            avatar_url=data.get('avatar_url')
        )
        db.session.add(new_entry)
        db.session.commit()
        return jsonify(new_entry.to_dict()), 201
    except ValueError:
        return jsonify({'error': 'Invalid data types for score or time_taken'}), 400
    except Exception as e:
        db.session.rollback()
        # To prevent information disclosure vulnerabilities, log the actual error internally
        # and return a generic safe message
        print(f"Error adding score: {e}")
        return jsonify({'error': 'Failed to add score'}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    # Calculate stats per player
    all_scores = ScoreEntry.query.all()

    stats_map = {}
    for entry in all_scores:
        name = entry.player_name
        if name not in stats_map:
            stats_map[name] = {
                'player_name': name,
                'games_played': 0,
                'total_score': 0,
                'high_score': entry.score,
                'latest_score': entry.score,
                'latest_timestamp': entry.timestamp,
                'avatar_url': entry.avatar_url
            }

        player_stats = stats_map[name]
        player_stats['games_played'] += 1
        player_stats['total_score'] += entry.score

        if entry.score > player_stats['high_score']:
            player_stats['high_score'] = entry.score

        if entry.timestamp and player_stats['latest_timestamp'] and entry.timestamp > player_stats['latest_timestamp']:
            player_stats['latest_score'] = entry.score
            player_stats['latest_timestamp'] = entry.timestamp
            # Update avatar to the most recently used one
            if entry.avatar_url:
                player_stats['avatar_url'] = entry.avatar_url

    # Calculate average and format output
    result = []
    for stats in stats_map.values():
        stats['average_score'] = round(stats['total_score'] / stats['games_played'], 2)
        # Convert datetime to string for JSON serialization
        if stats['latest_timestamp']:
            stats['latest_timestamp'] = stats['latest_timestamp'].isoformat()
        del stats['total_score'] # Remove intermediate value
        result.append(stats)

    return jsonify(result)

@app.route('/api/export', methods=['GET'])
def export_csv():
    scores = ScoreEntry.query.order_by(ScoreEntry.score.desc()).all()

    def generate():
        data = StringIO()
        writer = csv.writer(data)

        # Write header
        writer.writerow(('ID', 'Player Name', 'Score', 'Time Taken (s)', 'Timestamp', 'Avatar URL'))
        yield data.getvalue()
        data.seek(0)
        data.truncate(0)

        # Write rows
        for score in scores:
            writer.writerow((
                score.id,
                score.player_name,
                score.score,
                score.time_taken,
                score.timestamp.isoformat() if score.timestamp else '',
                score.avatar_url
            ))
            yield data.getvalue()
            data.seek(0)
            data.truncate(0)

    return Response(generate(), mimetype='text/csv', headers={'Content-Disposition': 'attachment; filename=scoreboard_export.csv'})

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=False)
