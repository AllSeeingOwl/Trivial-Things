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

## Phone remote (hide words from the room)

When the board is on a TV, choosing a word would show it to everyone, including the person spelling it. The phone remote keeps it hidden until the quizmaster is ready:

1. On your phone, open `/host` (for example `http://<server>/host`) and tap **Start a remote**. It shows a four-letter code.
2. On the board, choose **Use a phone as the remote** and type the code, or open the `/?remote=CODE` link the phone shows.
3. Tap a word on the phone. The TV marks that tile as chosen but keeps the word hidden; the phone shows the word and its expected spelling for the current mode.
4. Tap **Show on TV** to reveal it. The phone also changes the grid and the spelling mode, and **Hide all words again** clears the board.

The TV checks for changes about once a second and is never sent a word before it is shown, so it can't be found in the page either. Only the phone that started the remote can control it (it keeps a private key in the browser, so a refresh keeps control). Remotes live in the server's memory and end after 12 idle hours or a server restart; start a new one and reconnect the board if that happens.
