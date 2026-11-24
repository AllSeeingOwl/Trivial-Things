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

The TV checks for changes about once a second and is never sent a word before it is shown, so it can't be found in the page either. The grids are public (they're in this repository), so each remote also deals the words into its own random layout that only the phone sees: "word 2-3" on the TV can't be looked up anywhere. Only the phone that started the remote can control it (it keeps a private key in the browser, so a refresh keeps control). Remotes live in the server's memory and end after 12 idle hours or a server restart; start a new one and reconnect the board if that happens.

## Smart TVs

TVs differ a lot, so there are two ways to get the board onto one:

- **The TV's own web browser.** Open the What The Spell address (or the Trivial Things portal) in it, choose **Use a phone as the remote** and type the code with the TV remote. The board is written to work in older TV browsers: it's checked against Chrome 53 and later (about the browsers in 2018 LG and Samsung TVs), Samsung Internet 6.2 and later, and Safari 10 and later, in plain ES5 JavaScript with fallbacks for CSS Grid, `clamp()`, flexbox `gap` and `:focus-visible`. While following a remote it keeps clear of the screen edges (many TVs crop them) and fits on one screen at common TV sizes (1920x1080, 1280x720, 960x540), because scrolling with a TV remote is awkward.
- **No browser on the TV.** Some TVs and streaming boxes have no web browser, among them Roku and Apple TV, many Chromecast and Google TV devices, and some cheaper sets. Open the board on a laptop or tablet instead and put it on the TV with an HDMI cable, Chrome's **Cast tab**, AirPlay screen mirroring, or the TV's own screen mirroring.

Whichever way you choose, **don't mirror the quizmaster's phone to the TV**: the phone shows every word.

Older TV browsers can still behave in ways no checker catches (memory limits, unusual keyboards, screensavers), so try the board on the actual TV before the night. Where a TV supports it, the board asks the screen to stay on while following a remote; otherwise the TV's own power settings decide.

To re-check the board after changing its scripts or styles: `cd tools/frontend && npm ci && npm run check:tv`. The **TV compatibility** workflow runs the same check on pull requests.
