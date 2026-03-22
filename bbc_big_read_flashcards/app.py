import os
import json
from flask import Flask, jsonify, render_template

app = Flask(__name__)

GRID_DATA_FILE = os.path.join(os.path.dirname(__file__), 'grid_data.json')


def load_grid_data():
    if os.path.exists(GRID_DATA_FILE):
        with open(GRID_DATA_FILE, 'r') as f:
            return json.load(f)
    return []


@app.route('/')
def index():
    grid_data = load_grid_data()
    return render_template('index.html', grid=grid_data)


@app.route('/api/grid')
def get_grid():
    grid_data = load_grid_data()
    return jsonify({'grid': grid_data})


if __name__ == '__main__':
    app.run(debug=True, port=5002, host='0.0.0.0')
