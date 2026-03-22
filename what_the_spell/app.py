import csv
import os
from flask import Flask, jsonify, render_template

app = Flask(__name__)

CSV_FILE = os.path.join(os.path.dirname(__file__), 'What The Spell.csv')


def load_data():
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

    return grids, pool


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


if __name__ == '__main__':
    # Run on port 5001 to avoid conflicting with main app
    app.run(debug=False, port=5001, host='0.0.0.0')
