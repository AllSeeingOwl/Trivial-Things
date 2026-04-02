from flask import Flask, jsonify, render_template, request
import csv
import random
import os

app = Flask(__name__)

CSV_FILE = 'Questions_And_Segues.csv'

# In-Memory Cache for performance optimization (similar to trivia_flashcards)
_chains_cache = None


def load_chains():
    global _chains_cache

    # Return cached data if already loaded
    if _chains_cache is not None:
        return _chains_cache

    chains = {}
    if not os.path.exists(CSV_FILE):
        return chains

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r_idx, row in enumerate(reader):
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
            used_status = row.get('USED', 'FALSE').strip().upper() == 'TRUE'

            if chain_id not in chains:
                chains[chain_id] = {
                    'chain_id': chain_id,
                    # Will determine below if the whole chain is used
                    'used': True,
                    'questions': []
                }

            chains[chain_id]['questions'].append({
                'row_idx': r_idx + 1,  # +1 because of header
                'order': order,
                'question': question_text,
                'answer': answer_text,
                'used': used_status
            })

    # Sort questions by order and determine chain used status
    for chain_id, chain_data in chains.items():
        chain_data['questions'].sort(key=lambda x: x['order'])
        # If any question in the chain is NOT used, the chain is
        # considered NOT used.
        # Alternatively, we could just say if ALL questions are used,
        # the chain is used.
        all_used = all(q['used'] for q in chain_data['questions'])
        chain_data['used'] = all_used

    _chains_cache = chains
    return _chains_cache


def update_chain_used_status(chain_id, used_status):
    chains = load_chains()
    if chain_id not in chains:
        return

    # Update CSV File
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    # The header is row 0
    header = rows[0]
    used_col_idx = header.index('USED')

    for q in chains[chain_id]['questions']:
        row_idx = q['row_idx']
        # Pad row just in case
        rows[row_idx] = rows[row_idx] + [''] * \
            (len(header) - len(rows[row_idx]))
        rows[row_idx][used_col_idx] = 'TRUE' if used_status else 'FALSE'

    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    # Update cache
    if _chains_cache is not None:
        chain_to_update = _chains_cache.get(chain_id)
        if chain_to_update:
            chain_to_update['used'] = used_status
            for q in chain_to_update['questions']:
                q['used'] = used_status


def reset_all_chains():
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    if not rows:
        return

    header = rows[0]
    used_col_idx = header.index('USED')

    for r_idx in range(1, len(rows)):
        rows[r_idx] = rows[r_idx] + [''] * (len(header) - len(rows[r_idx]))
        rows[r_idx][used_col_idx] = 'FALSE'

    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

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

    if not isinstance(chain_id, str):
        return jsonify({'error': 'Invalid chain_id format'}), 400

    try:
        update_chain_used_status(chain_id, True)
    except Exception as e:
        # Sentinel: Log actual error but return generic message
        # to avoid leaking internals
        print(f"Security/Error processing mark_used: {e}")
        return jsonify({'error': 'Failed to process request'}), 500

    chains = load_chains()
    unused_chains = [c for c_id, c in chains.items() if not c['used']]

    return jsonify({
        'success': True,
        'stats': {
            'total': len(chains),
            'used': len(chains) - len(unused_chains),
            'remaining': len(unused_chains)
        }
    })


@app.route('/api/reset', methods=['POST'])
def reset():
    reset_all_chains()

    chains = load_chains()
    unused_chains = [c for c_id, c in chains.items() if not c['used']]

    return jsonify({
        'success': True,
        'stats': {
            'total': len(chains),
            'used': len(chains) - len(unused_chains),
            'remaining': len(unused_chains)
        }
    })


@app.route('/api/stats', methods=['GET'])
def get_stats():
    chains = load_chains()
    total = len(chains)
    used = len([c for c in chains.values() if c['used']])
    return jsonify({'total': total, 'used': used, 'remaining': total - used})


if __name__ == '__main__':
    # Use port 5003 for this application so it doesn't conflict
    # with trivia_flashcards (5000), what_the_spell (5001), etc.
    app.run(debug=False, port=5003, host='0.0.0.0')
