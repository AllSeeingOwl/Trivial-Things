from flask import Flask, jsonify, render_template, request
import csv
import random
import os

app = Flask(__name__)
# Sentinel: Explicitly disable debug mode to prevent RCE vulnerabilities
app.config['DEBUG'] = False

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

CSV_FILE = 'Questions & All That.csv'

# ⚡ Bolt Optimization: In-Memory Cache
# Caches the CSV rows in memory to prevent reading and parsing the entire file
# on every /api/question and /api/stats request, significantly reducing file I/O operations.
_questions_cache = None

def load_questions():
    global _questions_cache

    # Return cached data if already loaded to skip expensive file I/O
    if _questions_cache is not None:
        return _questions_cache

    # ⚡ Bolt Optimization: O(1) Cache Lookups
    # Convert the in-memory list cache to a dictionary to enable O(1) hash map lookups
    # when updating the used status, eliminating an O(N) linear search on every /api/mark_used request.
    questions = {}
    if not os.path.exists(CSV_FILE):
        return questions

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for r_idx, row in enumerate(reader):
            # Pad row if necessary to ensure it has 6 columns
            row = row + [''] * (6 - len(row))

            # Check Set A (Cols 0, 1, 2)
            q_a = row[0].strip()
            if q_a and q_a not in ['Set A', 'Set B'] and not q_a.startswith(','):
                questions[f"{r_idx}_A"] = {
                    'id': f"{r_idx}_A",
                    'row': r_idx,
                    'set': 'A',
                    'question': q_a,
                    'answer': row[1].strip(),
                    'used': row[2].strip().upper() == 'TRUE'
                }

            # Check Set B (Cols 3, 4, 5)
            q_b = row[3].strip()
            if q_b and q_b not in ['Set A', 'Set B'] and not q_b.startswith(','):
                questions[f"{r_idx}_B"] = {
                    'id': f"{r_idx}_B",
                    'row': r_idx,
                    'set': 'B',
                    'question': q_b,
                    'answer': row[4].strip(),
                    'used': row[5].strip().upper() == 'TRUE'
                }

    _questions_cache = questions
    return _questions_cache


def update_used_status(q_id, used_status):
    row_idx_str, set_type = q_id.split('_')
    row_idx = int(row_idx_str)

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    # ⚡ Bolt Optimization: Targeted Row Padding
    # Instead of an O(n) loop padding every single row in the CSV file,
    # we only pad the specific row we are modifying. This eliminates unnecessary operations.
    rows[row_idx] = rows[row_idx] + [''] * (6 - len(rows[row_idx]))

    if set_type == 'A':
        rows[row_idx][2] = 'TRUE' if used_status else 'FALSE'
    elif set_type == 'B':
        rows[row_idx][5] = 'TRUE' if used_status else 'FALSE'

    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    # Keep the in-memory cache synchronized with the CSV disk writes
    # ⚡ Bolt Optimization: O(1) hash map lookup completely replaces legacy O(N) loop
    global _questions_cache
    if _questions_cache is not None and q_id in _questions_cache:
        _questions_cache[q_id]['used'] = used_status

def reset_all_questions():
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    qs = load_questions()
    for q in qs.values():
        r_idx = q['row']
        # ⚡ Bolt Optimization: Targeted Row Padding
        # Instead of an O(n) loop padding every single row upfront,
        # we only pad the rows that are actually being reset.
        rows[r_idx] = rows[r_idx] + [''] * (6 - len(rows[r_idx]))
        if q['set'] == 'A':
            rows[r_idx][2] = 'FALSE'
        elif q['set'] == 'B':
            rows[r_idx][5] = 'FALSE'

    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    # Synchronize the cache reset with the disk writes
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

    if not isinstance(q_id, str) or '_' not in q_id:
        return jsonify({'error': 'Invalid question ID format'}), 400

    try:
        update_used_status(q_id, True)
    except Exception:
        return jsonify({'error': 'Failed to process request'}), 500

    return jsonify({'success': True})


@app.route('/api/reset', methods=['POST'])
def reset():
    reset_all_questions()
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=False, port=5000, host='0.0.0.0')
