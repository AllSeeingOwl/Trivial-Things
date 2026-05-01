# What The Spell

A Flask web application that generates interactive spelling grids/games based on a CSV file.

## Features

- Reads spelling grids and data from a CSV file (`What The Spell.csv` by default).
- Presents the data in a visual grid format for spelling games or exercises.
- Simple, user-friendly web interface.

## Requirements

- Python 3.6+
- Flask

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Ensure your CSV file is in the root directory (or configure the path using the `CSV_FILE` environment variable).

## Running the App

Start the Flask server:
```bash
python3 what_the_spell_app.py
```

By default, the server runs on port `5001` (configurable via the `PORT` environment variable).

Then open your browser and go to:
[http://127.0.0.1:5001](http://127.0.0.1:5001)

## Usage

- Navigate through the available spelling grids using the web interface.
- Interact with the grids to play the game or complete the spelling exercises.
