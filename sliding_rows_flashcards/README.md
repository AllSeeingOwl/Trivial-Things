# Sliding Rows Flashcards

A Flask web application that creates interactive "sliding row" flashcards from a CSV file, useful for studying sequences, chains, or conversational segues.

## Features

- Reads data from a CSV file (`Questions_And_Segues.csv` by default).
- Presents data as chains of related concepts.
- Tracks used chains to ensure new content is shown.
- Provides statistics on total, used, and remaining chains.
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
python3 sliding_rows_flashcards_app.py
```

By default, the server runs on port `5003` (configurable via the `PORT` environment variable).

Then open your browser and go to:
[http://127.0.0.1:5003](http://127.0.0.1:5003)

## Usage

- The application will load chains from the CSV file.
- Interact with the interface to reveal parts of the chain.
- Mark chains as used to remove them from the active pool.
- Use the reset functionality to clear the used status of all chains.
