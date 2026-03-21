from flask import Flask, jsonify, render_template, request
import csv
import random
import os

app = Flask(__name__)

CSV_FILE = 'MCQ Questions.csv'

# ⚡ Bolt Optimization: In-Memory Cache
# Caches the CSV rows in memory to prevent reading and parsing the entire file
# on every /api/question and /api/stats request, significantly reducing file I/O operations.
_questions_cache = None

def load_questions():
    global _questions_cache

    # Return cached data if already loaded to skip expensive file I/O
    if _questions_cache is not None:
        return _questions_cache

    questions = []
    if not os.path.exists(CSV_FILE):
        return questions

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for r_idx, row in enumerate(reader):
            # Skip header row
            if r_idx == 0 and row[0].strip().lower() == 'question':
                continue

            # Pad row if necessary to ensure it has 6 columns
            row = row + [''] * (6 - len(row))

            q_text = row[0].strip()
            if q_text:
                choices = [row[1].strip(), row[2].strip(), row[3].strip(), row[4].strip()]
                # filter out empty choices
                choices = [c for c in choices if c]
                questions.append({
                    'id': f"{r_idx}",
                    'row': r_idx,
                    'question': q_text,
                    'answer': row[1].strip(),
                    'choices': choices,
                    'used': row[5].strip().upper() == 'TRUE'
                })

    _questions_cache = questions
    return _questions_cache


def update_used_status(q_id, used_status):
    row_idx = int(q_id)

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    for i in range(len(rows)):
        rows[i] = rows[i] + [''] * (6 - len(rows[i]))

    rows[row_idx][5] = 'TRUE' if used_status else 'FALSE'

    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    # Keep the in-memory cache synchronized with the CSV disk writes
    global _questions_cache
    if _questions_cache is not None:
        for q in _questions_cache:
            if q['id'] == q_id:
                q['used'] = used_status
                break

def reset_all_questions():
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        rows = list(csv.reader(f))

    for i in range(len(rows)):
        rows[i] = rows[i] + [''] * (6 - len(rows[i]))

    qs = load_questions()
    for q in qs:
        r_idx = q['row']
        rows[r_idx][5] = 'FALSE'

    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    # Synchronize the cache reset with the disk writes
    global _questions_cache
    if _questions_cache is not None:
        for q in _questions_cache:
            q['used'] = False

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/question', methods=['GET'])
def get_random_question():
    questions = load_questions()
    unused_questions = [q for q in questions if not q['used']]

    if not unused_questions:
        return jsonify({'error': 'No unused questions left!'}), 404

    question = random.choice(unused_questions)

    # Shuffle the choices before sending them so the correct answer isn't always first
    question_data = dict(question)
    random.shuffle(question_data['choices'])

    return jsonify(question_data)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    questions = load_questions()
    total = len(questions)
    used = len([q for q in questions if q['used']])
    return jsonify({'total': total, 'used': used, 'remaining': total - used})


@app.route('/api/mark_used', methods=['POST'])
def mark_used():
    data = request.json
    if data is None or not isinstance(data, dict):
        return jsonify({'error': 'Invalid or missing JSON payload'}), 400

    q_id = data.get('id')
    if not q_id:
        return jsonify({'error': 'Missing question ID'}), 400

    if not isinstance(q_id, str) or not q_id.isdigit():
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
