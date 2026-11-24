import csv
import os
from flask import Flask, jsonify, render_template, request

try:
    from sentry_setup import init_sentry
    from rooms import RoomError, RoomStore, RoomsFull
except ModuleNotFoundError:
    from what_the_spell.sentry_setup import init_sentry
    from what_the_spell.rooms import RoomError, RoomStore, RoomsFull

# Start Sentry (if SENTRY_DSN is set) before the Flask app is created.
init_sentry("what_the_spell")

app = Flask(__name__)
# Sentinel: Explicitly disable debug mode to prevent RCE vulnerabilities
app.config['DEBUG'] = False
# Sentinel: Limit upload size/payload to 1MB to prevent DoS attacks
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';"
    return response

CSV_FILE = os.environ.get('CSV_FILE', os.path.join(os.path.dirname(__file__), 'What The Spell.csv'))

# ⚡ Bolt Optimization: In-Memory Cache
# Caches the CSV rows in memory to prevent reading and parsing the entire file
# on every / and /api/grid/<int:grid_idx> request, reducing I/O operations.
_cache_grids = None
_cache_pool = None


def load_data():
    global _cache_grids, _cache_pool

    # Return cached data if already loaded to skip expensive file I/O
    if _cache_grids is not None and _cache_pool is not None:
        return _cache_grids, _cache_pool

    grids = []
    pool = []

    if not os.path.exists(CSV_FILE):
        return grids, pool

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        current_grid = None
        for row in reader:
            if not any(row):
                continue

            # If the row looks like the header of a grid "1,2,3,4,5,6,"
            if row[0] == '1' and row[1] == '2' and row[2] == '3':
                current_grid = []
                grids.append(current_grid)
                continue

            # If we are in a grid and the row has the row number at the end
            # "word1, word2, word3, word4, word5, word6, row_num"
            if (current_grid is not None and len(row) >= 7 and
                    row[6].strip().isdigit()):
                words = [w.strip() for w in row[:6]]
                current_grid.append(words)

                # If we've added 10 rows, the grid is complete
                if len(current_grid) == 10:
                    current_grid = None
            else:
                # Part of the pool of individual words
                if row[0].strip() and not row[0].strip().isdigit():
                    pool.append(row[0].strip())

    _cache_grids = grids
    _cache_pool = pool

    return _cache_grids, _cache_pool


# ⚡ Bolt Optimization: Pre-Warm Cache at Module Startup
# Eagerly trigger load_data() during application initialization to pre-populate
# _cache_grids and _cache_pool, eliminating CSV file reading and parsing I/O
# latency on the initial incoming HTTP request (~100% first-request I/O latency reduction).
load_data()


@app.route('/')
def index():
    grids, _ = load_data()
    return render_template('index.html', num_grids=len(grids))


@app.route('/api/grid/<int:grid_idx>')
def get_grid(grid_idx):
    grids, _ = load_data()
    if 0 <= grid_idx < len(grids):
        return jsonify({'grid': grids[grid_idx]})
    return jsonify({'error': 'Grid not found'}), 404


# --- Phone remote ------------------------------------------------------------------------
# The quizmaster's phone starts a room and controls it; the TV joins by code and is only
# ever sent words that have been revealed. See rooms.py.

ROOMS = RoomStore(lambda: load_data()[0])


def _no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.route('/host')
def host_page():
    return render_template('host.html')


@app.route('/api/rooms', methods=['POST'])
def create_room():
    try:
        room = ROOMS.create()
    except RoomsFull:
        return jsonify({'error': 'Too many remotes are running. Try again later.'}), 503
    return _no_store(jsonify({'code': room.code, 'token': room.token, 'state': ROOMS.host_state(room)})), 201


@app.route('/api/rooms/<code>')
def room_display_state(code):
    room = ROOMS.get(code)
    if room is None:
        return jsonify({'error': 'No remote with that code.'}), 404
    return _no_store(jsonify(ROOMS.display_state(room)))


def _host_room(code):
    room = ROOMS.get(code)
    if room is None:
        return None, (jsonify({'error': 'No remote with that code.'}), 404)
    if not ROOMS.is_host(room, request.headers.get('X-Host-Token', '')):
        return None, (jsonify({'error': 'This phone is not the remote for that code.'}), 403)
    return room, None


@app.route('/api/rooms/<code>/host')
def room_host_state(code):
    room, err = _host_room(code)
    if err:
        return err
    return _no_store(jsonify(ROOMS.host_state(room)))


@app.route('/api/rooms/<code>/actions', methods=['POST'])
def room_action(code):
    room, err = _host_room(code)
    if err:
        return err
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Send a JSON object.'}), 400
    try:
        ROOMS.act(room, data.get('action'), data)
    except RoomError as e:
        return jsonify({'error': str(e)}), 400
    return _no_store(jsonify(ROOMS.host_state(room)))


if __name__ == '__main__':
    # Run on port 5001 to avoid conflicting with main app
    port = int(os.environ.get('PORT', 5001))
    host = os.environ.get('HOST', '127.0.0.1')
    app.run(debug=False, port=port, host=host)
