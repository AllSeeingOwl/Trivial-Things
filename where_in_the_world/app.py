import csv
import re
import math
import random
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)


def parse_coordinates(location_text):
    """
    Extracts the decimal latitude and longitude from the location text.
    It expects a format like '51.605582, -0.068164' on one of the lines.
    """
    lines = location_text.split('\n')
    for line in lines:
        match = re.search(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)', line)
        if match:
            return float(match.group(1)), float(match.group(2))
    return None, None


def load_data():
    data = []
    try:
        with open(
                'Where In The World Is.csv', mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                prompt = row.get('...This Thing...', '').strip()
                location_col = (
                    '...Can Be Found Here (what3words + latitude & longitudes)'
                )
                location_text = row.get(location_col, '')
                lat, lng = parse_coordinates(location_text)
                if lat is not None and lng is not None and prompt:
                    data.append({
                        'id': str(i),
                        'place': row.get('The Place...', ''),
                        'prompt': prompt,
                        'lat': lat,
                        'lng': lng
                    })
    except Exception as e:
        print(f"Error loading CSV: {e}")
    return data


QUESTIONS = load_data()
QUESTIONS_BY_ID = {q['id']: q for q in QUESTIONS}


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in miles between two points
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * \
        math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 3956  # Radius of earth in miles
    return c * r


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/questions')
def get_questions():
    try:
        count = int(request.args.get('count', 5))
        if count <= 0:
            count = 5
    except ValueError:
        # Sentinel: Fallback to default instead of crashing and leaking stack traces
        count = 5

    if count > len(QUESTIONS):
        count = len(QUESTIONS)

    # Select random questions without duplicates
    selected = random.sample(QUESTIONS, count)

    # Send everything to client without coords initially to prevent cheating
    safe_selected = []
    for q in selected:
        safe_selected.append({
            'id': q['id'],
            'place': q['place'],
            'prompt': q['prompt']
        })
    return jsonify(safe_selected)


@app.route('/api/score', methods=['POST'])
def calculate_score():
    data = request.json
    if not data:
        return jsonify({'error': 'Missing request body'}), 400

    guess_lat = data.get('lat')
    guess_lng = data.get('lng')
    target_id = data.get('id')

    # Sentinel: Validate that target_id is a string to prevent unhandled TypeErrors
    # (e.g. unhashable type 'list' or 'dict') during dictionary lookups
    if not isinstance(target_id, str):
        return jsonify({'error': 'Invalid target ID format'}), 400

    # ⚡ Bolt Optimization: O(1) Dictionary Lookup
    # Use the pre-computed QUESTIONS_BY_ID dictionary instead of an O(N) linear search
    # through the QUESTIONS list to find the target location.
    target = QUESTIONS_BY_ID.get(target_id)
    # Security: Validate that coordinates are numeric to prevent crashes in haversine_distance
    if not isinstance(guess_lat, (int, float)) or \
       not isinstance(guess_lng, (int, float)):
        return jsonify({'error': 'Coordinates must be numbers'}), 400

    if not target:
        return jsonify({'error': 'Target not found'}), 404

    distance = haversine_distance(
        guess_lat, guess_lng, target['lat'], target['lng'])

    score = 0
    if distance <= 1:
        score = 10
    elif distance <= 10:
        score = 5
    elif distance <= 50:
        score = 2

    return jsonify({
        'distance_miles': distance,
        'score': score,
        'target_lat': target['lat'],
        'target_lng': target['lng']
    })


if __name__ == '__main__':
    # Sentinel: Disabled debug=True to prevent RCE and info disclosure
    app.run(port=5004, debug=False)
