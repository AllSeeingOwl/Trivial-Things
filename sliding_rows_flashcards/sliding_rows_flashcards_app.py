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


CSV_FILE = os.environ.get('CSV_FILE', 'Questions_And_Segues.csv')
DB_FILE = os.environ.get('DB_FILE', 'state.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS chain_state (
                id TEXT PRIMARY KEY,
                used BOOLEAN NOT NULL
            )
        ''')
        conn.commit()

init_db()


# In-Memory Cache for performance optimization (similar to trivia_flashcards)
_chains_cache = None
_raw_csv_cache = None



def load_chains():
    global _chains_cache, _raw_csv_cache

    if _chains_cache is not None and _raw_csv_cache is not None:
        return _chains_cache

    chains = {}
    if not os.path.exists(CSV_FILE):
        return chains

    if _raw_csv_cache is None:
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            _raw_csv_cache = list(csv.reader(f))

    if not _raw_csv_cache:
        return chains

    # Read state from SQLite
    state_map = {}
    with get_db_connection() as conn:
        rows = conn.execute('SELECT id, used FROM chain_state').fetchall()
        for r in rows:
            state_map[r['id']] = bool(r['used'])

    header = _raw_csv_cache[0]
    for r_idx in range(1, len(_raw_csv_cache)):
        row_raw = _raw_csv_cache[r_idx]
        row = {header[i]: row_raw[i] if i < len(row_raw) else '' for i in range(len(header))}
        chain_id = row.get('Chain_ID', '').strip()
        if not chain_id:
            continue

        order_str = row.get('Order', '').strip()
        try:
            order = int(order_str)
        except ValueError:
            order = 0

        question_text = row.get('Question', '').strip()
        answer_text = row.get('Answer', '').strip()

        if chain_id not in chains:
            chains[chain_id] = {
                'chain_id': chain_id,
                'used': True,
                'questions': []
            }

        # Check SQLite state first, fall back to CSV value
        used_status = state_map.get(f"{chain_id}_{order}", row.get('USED', 'FALSE').strip().upper() == 'TRUE')

        chains[chain_id]['questions'].append({
            'row_idx': r_idx,  # No +1 needed because r_idx is from 1 to len(raw)
            'order': order,
            'question': question_text,
            'answer': answer_text,
            'used': used_status
        })

    # Sort questions by order and determine chain used status
    for chain_id, chain_data in chains.items():
        chain_data['questions'].sort(key=lambda x: x['order'])
        all_used = all(q['used'] for q in chain_data['questions'])
        chain_data['used'] = all_used

    _chains_cache = chains
    return _chains_cache

def update_chain_used_status(chain_id, used_status):
    chains = load_chains()
    if chain_id not in chains:
        return

    # ⚡ Bolt Optimization: Use executemany to avoid N+1 query pattern
    # Batch all question status updates into a single database operation.
    with get_db_connection() as conn:
        data = [(f"{chain_id}_{q['order']}", used_status) for q in chains[chain_id]['questions']]
        conn.executemany('''
            INSERT INTO chain_state (id, used) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET used = excluded.used
        ''', data)
        conn.commit()

    # Update cache
    if _chains_cache is not None:
        chain_to_update = _chains_cache.get(chain_id)
        if chain_to_update:
            chain_to_update['used'] = used_status
            for q in chain_to_update['questions']:
                q['used'] = used_status

def reset_all_chains():
    # Reset in SQLite
    with get_db_connection() as conn:
        conn.execute('UPDATE chain_state SET used = 0')
        conn.commit()

        # ⚡ Bolt Optimization: Use executemany to avoid N+1 query pattern
        # Mark all known questions as FALSE in DB in a single batch operation.
        chains = load_chains()
        all_data = []
        for chain_id, chain_data in chains.items():
            if chain_data['used'] or any(q['used'] for q in chain_data['questions']):
                for q in chain_data['questions']:
                    all_data.append((f"{chain_id}_{q['order']}", False))

        if all_data:
            conn.executemany('''
                INSERT INTO chain_state (id, used) VALUES (?, ?)
                ON CONFLICT(id) DO UPDATE SET used = excluded.used
            ''', all_data)
            conn.commit()

    # Synchronize cache
    global _chains_cache
    if _chains_cache is not None:
        for chain_id, chain_data in _chains_cache.items():
            chain_data['used'] = False
            for q in chain_data['questions']:
                q['used'] = False

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/get_chain', methods=['GET'])
def get_random_chain():
    chains = load_chains()
    unused_chains = [chain_data for chain_id,
                     chain_data in chains.items() if not chain_data['used']]

    # ⚡ Bolt Optimization: Batch Network Requests
    # Include stats in the chain response to prevent the frontend from having
    # to make a second HTTP request to /api/stats on every chain load.
    stats = {
        'total': len(chains),
        'used': len(chains) - len(unused_chains),
        'remaining': len(unused_chains)
    }

    if not unused_chains:
        return jsonify(
            {'error': 'No unused chains left!', 'stats': stats}), 404

    random_chain = random.choice(unused_chains)
    return jsonify({
        'chain_id': random_chain['chain_id'],
        'questions': [{'order': q['order'], 'question': q['question'],
                   'answer': q['answer']} for q in
                      random_chain['questions']],
        'stats': stats
    })


@app.route('/api/mark_used', methods=['POST'])
def mark_used():
    data = request.json
    if data is None or not isinstance(data, dict):
        return jsonify({'error': 'Invalid or missing JSON payload'}), 400

    chain_id = data.get('chain_id')
    if not chain_id:
        return jsonify({'error': 'Missing chain_id'}), 400

    if not isinstance(chain_id, str) or len(chain_id) > 100:
        return jsonify({'error': 'Invalid chain_id format'}), 400

    try:
        update_chain_used_status(chain_id, True)
    except Exception as e:
        # Sentinel: Log actual error but return generic message
        # to avoid leaking internals
        print(f"Security/Error processing mark_used: {e}")
        return jsonify({'error': 'Failed to process request'}), 500

    chains = load_chains()
    # ⚡ Bolt Optimization: Memory-efficient counting
    # Used generator expression with sum() instead of creating an intermediate list
    # for len() to count unused chains, significantly reducing memory overhead.
    remaining_chains = sum(1 for c in chains.values() if not c['used'])

    return jsonify({
        'success': True,
        'stats': {
            'total': len(chains),
            'used': len(chains) - remaining_chains,
            'remaining': remaining_chains
        }
    })


@app.route('/api/reset', methods=['POST'])
def reset():
    reset_all_chains()

    chains = load_chains()
    # ⚡ Bolt Optimization: Memory-efficient counting
    # Used generator expression with sum() instead of creating an intermediate list
    # for len() to count unused chains, significantly reducing memory overhead.
    remaining_chains = sum(1 for c in chains.values() if not c['used'])

    return jsonify({
        'success': True,
        'stats': {
            'total': len(chains),
            'used': len(chains) - remaining_chains,
            'remaining': remaining_chains
        }
    })


@app.route('/api/stats', methods=['GET'])
def get_stats():
    chains = load_chains()
    total = len(chains)
    # ⚡ Bolt Optimization: Memory-efficient counting
    # Used generator expression with sum() instead of creating an intermediate list
    # for len() to count used chains, significantly reducing memory overhead.
    used = sum(1 for c in chains.values() if c['used'])
    return jsonify({'total': total, 'used': used, 'remaining': total - used})


if __name__ == '__main__':
    # Use port 5003 for this application so it doesn't conflict
    # with trivia_flashcards (5000), what_the_spell (5001), etc.
    port = int(os.environ.get('PORT', 5003))
    host = os.environ.get('HOST', '0.0.0.0')
    app.run(debug=False, port=port, host=host)
