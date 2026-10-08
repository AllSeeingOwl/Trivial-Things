import os
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)

# Security baseline
app.config['DEBUG'] = False
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024 # 1MB limit

# Database setup
db_file = os.environ.get('DB_FILE', 'state.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_file}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    category = db.Column(db.String(50), nullable=False) # 'Sporting', 'Cultural', 'Other'
    is_tentative = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'category': self.category,
            'is_tentative': self.is_tentative
        }

with app.app_context():
    db.create_all()

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none';"
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    return jsonify([event.to_dict() for event in events])

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Invalid or missing request body'}), 400

    title = data.get('title')
    start_date_val = data.get('start_date')
    end_date_val = data.get('end_date')
    category = data.get('category')

    if not title or not start_date_val or not end_date_val or not category:
        return jsonify({'error': 'Missing required fields'}), 400

    # Sentinel: Type, empty string, and length validation to prevent unhandled TypeErrors and DB/memory bloat DoS
    if not isinstance(title, str) or not title.strip() or len(title) > 100:
        return jsonify({'error': 'Invalid title format or length exceeded'}), 400

    if not isinstance(category, str) or not category.strip() or len(category) > 50:
        return jsonify({'error': 'Invalid category format or length exceeded'}), 400

    # Sentinel: Enforce string type and length limits on dates before parsing to prevent CPU exhaustion DoS
    if not isinstance(start_date_val, str) or len(start_date_val) > 20 or not isinstance(end_date_val, str) or len(end_date_val) > 20:
        return jsonify({'error': 'Invalid date length or format'}), 400

    try:
        start_date = datetime.strptime(start_date_val.strip(), '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_val.strip(), '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date < start_date:
        return jsonify({'error': 'End date must be after or equal to start date'}), 400

    new_event = Event(
        title=title.strip(),
        start_date=start_date,
        end_date=end_date,
        category=category.strip(),
        is_tentative=bool(data.get('is_tentative', False))
    )

    db.session.add(new_event)
    db.session.commit()

    return jsonify(new_event.to_dict()), 201

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return '', 204

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5006))
    app.run(host='0.0.0.0', port=port)
