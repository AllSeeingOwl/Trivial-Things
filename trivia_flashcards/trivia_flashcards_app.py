from flask import Flask, jsonify, render_template, request
import csv
import random
import os
import sqlite3

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


CSV_FILE = os.environ.get('CSV_FILE', 'Questions & All That.csv')
DB_FILE = os.environ.get('DB_FILE', 'state.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS question_state (
                id TEXT PRIMARY KEY,
                used BOOLEAN NOT NULL
            )
        ''')
        conn.commit()

init_db()


# ⚡ Bolt Optimization: In-Memory Cache
# Caches the CSV rows in memory to prevent reading and parsing the entire file
# on every /api/question and /api/stats request, significantly reducing file I/O operations.
_questions_cache = None
_raw_csv_cache = None


def load_questions():
    global _questions_cache, _raw_csv_cache

    if _questions_cache is not None and _raw_csv_cache is not None:
        return _questions_cache

    questions = {}
    if not os.path.exists(CSV_FILE):
        return questions

    if _raw_csv_cache is None:
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            _raw_csv_cache = list(csv.reader(f))

    # Read state from SQLite
    state_map = {}
    with get_db_connection() as conn:
        rows = conn.execute('SELECT id, used FROM question_state').fetchall()
        for r in rows:
            state_map[r['id']] = bool(r['used'])

    for r_idx, row in enumerate(_raw_csv_cache):
        # Pad row if necessary to ensure it has 6 columns
        row = row + [''] * (6 - len(row))

        # Check Set A (Cols 0, 1, 2)
        q_a = row[0].strip()
        if q_a and q_a not in ['Set A', 'Set B'] and not q_a.startswith(','):
            q_id = f"{r_idx}_A"
            used_status = state_map.get(q_id, row[2].strip().upper() == 'TRUE')
            questions[q_id] = {
                'id': q_id,
                'row': r_idx,
                'set': 'A',
                'question': q_a,
                'answer': row[1].strip(),
                'used': used_status
            }

        # Check Set B (Cols 3, 4, 5)
        q_b = row[3].strip()
        if q_b and q_b not in ['Set A', 'Set B'] and not q_b.startswith(','):
            q_id = f"{r_idx}_B"
            used_status = state_map.get(q_id, row[5].strip().upper() == 'TRUE')
            questions[q_id] = {
                'id': q_id,
                'row': r_idx,
                'set': 'B',
                'question': q_b,
                'answer': row[4].strip(),
                'used': used_status
            }

    _questions_cache = questions
    return _questions_cache

def update_used_status(q_id, used_status):
    row_idx_str, set_type = q_id.split('_')
    row_idx = int(row_idx_str)

    global _raw_csv_cache
    if _raw_csv_cache is None:
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            _raw_csv_cache = list(csv.reader(f))
    rows = _raw_csv_cache

    if row_idx < 0 or row_idx >= len(rows):
        raise ValueError(f"Question ID {q_id} (row {row_idx}) is out of bounds.")

    # Prevent modifying the header row (index 0)
    if row_idx == 0:
        raise ValueError(f"Question ID {q_id} (row {row_idx}) refers to the header row and cannot be modified.")

    # Save to SQLite instead of CSV
    with get_db_connection() as conn:
        conn.execute('''
            INSERT INTO question_state (id, used) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET used = excluded.used
        ''', (q_id, used_status))
        conn.commit()

    # Keep the in-memory cache synchronized
    global _questions_cache
    if _questions_cache is not None and q_id in _questions_cache:
        _questions_cache[q_id]['used'] = used_status

def reset_all_questions():
    # Reset in SQLite
    with get_db_connection() as conn:
        conn.execute('UPDATE question_state SET used = 0')
        conn.commit()

        # ⚡ Bolt Optimization: Use executemany to avoid N+1 query pattern
        # Mark all questions as FALSE in DB in a single batch operation.
        qs = load_questions()
        all_data = [(q_id, False) for q_id, q_data in qs.items() if q_data['used']]

        if all_data:
            conn.executemany('''
                INSERT INTO question_state (id, used) VALUES (?, ?)
                ON CONFLICT(id) DO UPDATE SET used = excluded.used
            ''', all_data)
            conn.commit()

    # Synchronize cache
    global _questions_cache
    if _questions_cache is not None:
        for q in _questions_cache.values():
            q['used'] = False

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/question', methods=['GET'])
def get_random_question():
    questions = load_questions()
    unused_questions = [q for q in questions.values() if not q['used']]

    # ⚡ Bolt Optimization: Batch Network Requests
    # Include stats in the question response to prevent the frontend from having
    # to make a second HTTP request to /api/stats on every question load.
    stats = {
        'total': len(questions),
        'used': len(questions) - len(unused_questions),
        'remaining': len(unused_questions)
    }

    if not unused_questions:
        return jsonify({'error': 'No unused questions left!', 'stats': stats}), 404

    question = random.choice(unused_questions)

    question_data = dict(question)
    question_data['stats'] = stats

    return jsonify(question_data)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    questions = load_questions()
    total = len(questions)
    # ⚡ Bolt Optimization: Memory-efficient counting
    # Used generator expression with sum() instead of creating an intermediate list
    # for len() to count used questions, significantly reducing memory overhead.
    used = sum(1 for q in questions.values() if q['used'])
    return jsonify({'total': total, 'used': used, 'remaining': total - used})


@app.route('/api/mark_used', methods=['POST'])
def mark_used():
    data = request.json
    if data is None or not isinstance(data, dict):
        return jsonify({'error': 'Invalid or missing JSON payload'}), 400

    q_id = data.get('id')
    if not q_id:
        return jsonify({'error': 'Missing question ID'}), 400

    if not isinstance(q_id, str) or '_' not in q_id or len(q_id) > 50:
        return jsonify({'error': 'Invalid question ID format'}), 400

    try:
        update_used_status(q_id, True)
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception:
        return jsonify({'error': 'Failed to process request'}), 500

    return jsonify({'success': True})


@app.route('/api/reset', methods=['POST'])
def reset():
    reset_all_questions()
    return jsonify({'success': True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    app.run(debug=False, port=port, host=host)
