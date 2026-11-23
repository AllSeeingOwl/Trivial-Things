"""Point It Out: a picture quiz where you answer by pointing.

Each question shows one or more pictures. You answer by clicking the right
picture or, when the question has an answer area, the right part of it.
Questions come from a CSV file. Pictures live in static/images, or in any
folder named by the PICTURES_DIR environment variable (for example a private
folder synced from Google Drive), so private pictures never enter the repo.
"""
import os
import csv
import math
import random
import re
from flask import Flask, abort, jsonify, request, render_template, send_from_directory

try:
    from sentry_setup import init_sentry
except ModuleNotFoundError:
    from point_it_out.sentry_setup import init_sentry

# Start Sentry (if SENTRY_DSN is set) before the Flask app is created.
init_sentry("point_it_out")

app = Flask(__name__)
app.config['DEBUG'] = False
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.abspath(os.path.expanduser(
    os.environ.get('PICTURES_DIR') or os.path.join(BASE_DIR, 'static', 'images')))
IMAGE_EXTENSIONS = ('.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp')
# Picture file names: letters, digits, dot, dash, underscore and spaces only, so
# nothing in the CSV or a URL can point outside the pictures folder.
SAFE_FILENAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9 ._-]*$')

# Scoring: inside the answer area (or the right picture when the question has
# no area) earns FULL_POINTS. A click on the right picture that misses the area
# by no more than NEAR_DISTANCE (as a fraction of the picture's size) earns
# NEAR_POINTS.
FULL_POINTS = 10
NEAR_POINTS = 5
NEAR_DISTANCE = 0.05


def parse_area(text):
    """Parse one or more 'left, top, width, height' boxes, in percent.

    Boxes are separated by ';', for answers found in more than one place (both
    C keys on a piano) or with an awkward shape. Returns a list of
    (left, top, width, height) tuples as 0-1 fractions, None for a blank cell,
    and raises ValueError for anything malformed.
    """
    text = (text or '').strip()
    if not text:
        return None
    return [parse_box(part) for part in text.split(';') if part.strip()] or None


def parse_box(text):
    text = text.strip()
    parts = [p.strip() for p in text.split(',')]
    if len(parts) != 4:
        raise ValueError(f'answer area needs 4 numbers, got {text!r}')
    left, top, width, height = (float(p) for p in parts)
    if any(math.isnan(v) or math.isinf(v) for v in (left, top, width, height)):
        raise ValueError(f'answer area must be finite: {text!r}')
    if left < 0 or top < 0 or width <= 0 or height <= 0 \
            or left + width > 100.01 or top + height > 100.01:
        raise ValueError(f'answer area must fit inside the picture: {text!r}')
    return (left / 100, top / 100, width / 100, height / 100)


def parse_row(row, row_number, image_dir=IMAGE_DIR, set_pictures=None):
    """Turn one CSV row into a question dict, or raise ValueError.

    Rows that share a Set name share pictures. set_pictures maps each set name
    already seen to its pictures: a row in a known set may leave Pictures blank
    to reuse them, but may not list different ones.
    """
    question = (row.get('Question') or '').strip()
    if not question:
        raise ValueError('missing question')

    set_name = (row.get('Set') or '').strip()
    known = (set_pictures or {}).get(set_name) if set_name else None
    pictures = [p.strip() for p in (row.get('Pictures') or '').split('|') if p.strip()]
    if not pictures and known:
        pictures = list(known)
    if not pictures:
        raise ValueError('no pictures')
    if known and pictures != known:
        raise ValueError(f'pictures differ from the rest of set {set_name!r}')
    for name in pictures:
        if not SAFE_FILENAME.match(name) or not name.lower().endswith(IMAGE_EXTENSIONS):
            raise ValueError(f'bad picture file name {name!r}')
        if not os.path.isfile(os.path.join(image_dir, name)):
            raise ValueError(f'picture not found: {name}')

    correct_text = (row.get('Correct Picture') or '1').strip() or '1'
    correct = int(correct_text) - 1
    if not 0 <= correct < len(pictures):
        raise ValueError(f'correct picture {correct_text} is not one of the {len(pictures)} pictures')

    area = parse_area(row.get('Answer Area'))
    q_id = str(row_number)
    category = (row.get('Category') or '').strip()
    return {
        'id': q_id,
        'set': set_name,
        'category': category,
        'question': question,
        'pictures': pictures,
        'correct': correct,
        'area': area,
        'explanation': (row.get('Explanation') or '').strip(),
        # What the player sees before answering: no answer fields.
        'public': {
            'id': q_id,
            'set': set_name,
            'category': category,
            'question': question,
            'pictures': pictures,
            'mode': 'area' if area else 'picture',
        },
    }


def load_data(csv_path=None, image_dir=IMAGE_DIR):
    csv_path = csv_path or os.environ.get('CSV_FILE', os.path.join(BASE_DIR, 'Point It Out.csv'))
    data = []
    set_pictures = {}
    try:
        with open(csv_path, mode='r', encoding='utf-8') as f:
            for i, row in enumerate(csv.DictReader(f)):
                try:
                    q = parse_row(row, i, image_dir, set_pictures)
                    if q['set']:
                        set_pictures.setdefault(q['set'], q['pictures'])
                    data.append(q)
                except (ValueError, TypeError) as e:
                    # CSV row i is on line i + 2 (after the header).
                    print(f'Skipping CSV line {i + 2}: {e}')
    except OSError as e:
        print(f'Error loading CSV: {e}')
    return data


QUESTIONS = load_data()
QUESTIONS_BY_ID = {q['id']: q for q in QUESTIONS}


def distance_to_area(x, y, area):
    """Distance from point (x, y) to the box, 0 when inside. All 0-1 fractions."""
    left, top, width, height = area
    dx = max(left - x, 0, x - (left + width))
    dy = max(top - y, 0, y - (top + height))
    return math.hypot(dx, dy)


def score_answer(question, picture, x, y):
    """Return (points, verdict) where verdict is 'correct', 'close' or 'wrong'."""
    if picture != question['correct']:
        return 0, 'wrong'
    boxes = question['area']
    if boxes is None:
        return FULL_POINTS, 'correct'
    distance = min(distance_to_area(x, y, box) for box in boxes)
    if distance == 0:
        return FULL_POINTS, 'correct'
    if distance <= NEAR_DISTANCE:
        return NEAR_POINTS, 'close'
    return 0, 'wrong'


def is_fraction(value):
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value) and 0 <= value <= 1)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/editor')
def editor():
    return render_template('editor.html')


@app.route('/api/questions')
def get_questions():
    count_str = request.args.get('count', '5')
    try:
        count = int(count_str) if len(count_str) <= 10 else 5
    except ValueError:
        count = 5
    if count <= 0:
        count = 5
    return jsonify([q['public'] for q in pick_questions(QUESTIONS, count)])


# Most questions from one set played in a single game, so a set with dozens of
# questions doesn't take over the whole game.
SET_ROUND_SIZE = 5


def pick_questions(questions, count, per_set=SET_ROUND_SIZE):
    """Pick up to count questions at random, keeping each set's questions together.

    A set's questions are played back to back (in random order), so players
    keep looking at the same pictures. At most per_set questions come from any
    one set, unless there aren't enough questions otherwise. The last set
    picked may be cut short to hit the count.
    """
    groups = {}
    order = []
    for q in questions:
        key = ('set', q['set']) if q['set'] else ('single', q['id'])
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(q)
    random.shuffle(order)
    for group in groups.values():
        random.shuffle(group)
    # Take up to per_set from each set; if that's not enough to reach count,
    # take more from each set in further passes.
    taken = {key: 0 for key in order}
    limit = per_set
    while True:
        total = sum(taken.values())
        if total >= count or all(taken[k] == len(groups[k]) for k in order):
            break
        for key in order:
            taken[key] = min(len(groups[key]), max(taken[key], limit))
        limit += per_set
    picked = []
    for key in order:
        if len(picked) >= count:
            break
        picked.extend(groups[key][:taken[key]])
    return picked[:count]


@app.route('/api/answer', methods=['POST'])
def answer():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid or missing request body'}), 400

    q_id = data.get('id')
    picture = data.get('picture')
    x = data.get('x')
    y = data.get('y')
    if not isinstance(q_id, str) or len(q_id) > 100:
        return jsonify({'error': 'Invalid question ID'}), 400
    if isinstance(picture, bool) or not isinstance(picture, int):
        return jsonify({'error': 'Picture must be a whole number'}), 400
    if not is_fraction(x) or not is_fraction(y):
        return jsonify({'error': 'x and y must be numbers from 0 to 1'}), 400

    question = QUESTIONS_BY_ID.get(q_id)
    if not question:
        return jsonify({'error': 'Question not found'}), 404
    if not 0 <= picture < len(question['pictures']):
        return jsonify({'error': 'Picture out of range'}), 400

    points, verdict = score_answer(question, picture, x, y)
    boxes = question['area'] or []
    return jsonify({
        'points': points,
        'verdict': verdict,
        'correct_picture': question['correct'],
        'areas': [dict(zip(('left', 'top', 'width', 'height'), box)) for box in boxes],
        'explanation': question['explanation'],
    })


@app.route('/pictures/<name>')
def picture(name):
    if not SAFE_FILENAME.match(name) or not name.lower().endswith(IMAGE_EXTENSIONS):
        abort(404)
    return send_from_directory(IMAGE_DIR, name)


@app.route('/api/images')
def list_images():
    """Picture files available to the question editor."""
    try:
        names = sorted(n for n in os.listdir(IMAGE_DIR)
                       if n.lower().endswith(IMAGE_EXTENSIONS) and SAFE_FILENAME.match(n))
    except OSError:
        names = []
    return jsonify(names)


@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'"
    )
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
    return response


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5010))
    host = os.environ.get('HOST', '127.0.0.1')
    app.run(debug=False, port=port, host=host)
