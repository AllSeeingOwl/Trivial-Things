# Trivia and Flashcards Apps

Welcome to the Trivia and Flashcards repository! This collection features fourteen interactive, web-based applications designed to help you study, run trivia nights, play educational games, or put things on a TV. Each application focuses on a unique style of learning and questioning.

## The Applications

The repository is organized into fourteen distinct applications (eleven Flask, one Next.js, two static HTML pages):

### 1. Trivia Flashcards (`trivia_flashcards/`)
A flashcard web app perfect for classic trivia and quiz games.
*   **Features**: Randomizes questions from a CSV file (`Questions & All That.csv`), presenting a "front" (question) and a "back" (answer). You can eliminate questions as they are asked, ensuring they won't repeat, with state tracked via an SQLite database.
*   **Phone remote**: run the board on a TV from your phone, with each answer hidden until you show it. See [Phone remote](#phone-remote) below.
*   **Running**: `cd trivia_flashcards && python3 trivia_flashcards_app.py` (Runs on port 5000 by default).

### 2. MCQ Flashcards (`mcq_flashcards/`)
A multiple-choice variant of the trivia flashcards.
*   **Features**: Reads from `MCQ Questions.csv` and presents four randomized choices per question. Includes visual feedback for correct/incorrect choices before revealing the back of the card. State is also saved via an SQLite database to prevent repeats.
*   **Phone remote**: run the board on a TV from your phone; mark the team's answer on the phone, then reveal whether it's right. See [Phone remote](#phone-remote) below.
*   **Running**: `cd mcq_flashcards && python3 mcq_flashcards_app.py` (Runs on port 5000 by default).

### 3. What The Spell (`what_the_spell/`)
A spelling-focused interactive grid application.
*   **Features**: Parses spelling grids from `What The Spell.csv` and displays them via a slick interface. Uses in-memory caching for speedy grid loading. A phone remote keeps words hidden from the room: the quizmaster opens `/host` on their phone, starts a remote and gets a four-letter code, then connects the board on the TV with that code. The phone shows every word; the TV only shows which word was chosen until the quizmaster taps **Show on TV**, and the server never sends the TV a word before then.
*   **Running**: `cd what_the_spell && python3 what_the_spell_app.py` (Runs on port 5001 by default).

### 4. PDF Grid Flashcards (`pdf_grid_flashcards/`)
An application that generates interactive grid views by parsing structured PDFs.
*   **Features**: Upload a PDF (like a crossword or grid puzzle), and the app uses PyMuPDF (`fitz`) to extract text and colored regions, rendering an interactive HTML grid where you can verify correct/incorrect cells.
*   **Running**: `cd pdf_grid_flashcards && python3 pdf_grid_flashcards_app.py` (Runs on port 5002 by default).

### 5. Sliding Rows Flashcards (`sliding_rows_flashcards/`)
An application that presents sliding rows of flashcards and segues.
*   **Features**: Reads data from `Questions_And_Segues.csv` to provide a unique flashcard learning experience. State is tracked via an SQLite database.
*   **Phone remote**: run the board on a TV from your phone, showing each row's question and then its answer. See [Phone remote](#phone-remote) below.
*   **Running**: `cd sliding_rows_flashcards && python3 sliding_rows_flashcards_app.py` (Runs on port 5003 by default).

### 6. Where In The World (`where_in_the_world/`)
An interactive map-based game application.
*   **Features**: Serves an interactive game using Leaflet.js maps and `Where In The World Is.csv` as its data source. Scores guesses based on Haversine distance between the guessed location (via click, Plus Codes, Geohash, Decimal/DMS Coordinates, or Nominatim search) and the target.
*   **Running**: `cd where_in_the_world && python3 where_in_the_world_app.py` (Runs on port 5004 by default).

### 7. Interactive Scoreboard (`interactive_scoreboard/`)
A standalone interactive scoreboard application that allows users to track scores, view rankings, calculate player statistics, and export data.
*   **Features**: Features both a web UI for manual input and API endpoints for automated digital recording. Includes persistent storage via SQLite.
*   **Running**: `cd interactive_scoreboard && python3 scoreboard_app.py` (Runs on port 5000 by default).

### 8. Price Time Machine (`price_time_machine/`)
An application to see historical prices adjusted for inflation.
*   **Features**: View prices of global and local items from different countries adjusted for inflation to modern prices.
*   **Running**: `cd price_time_machine && python3 price_time_machine_app.py` (Runs on port 5000 by default).

### 9. Right Here Right Now (`right-here-right-now/`)
A Next.js dashboard application.
*   **Features**: Uses Tailwind CSS, native CSS columns for a Pinterest-like masonry layout, and a 24-hour data cache so widgets refresh daily. Deployed on Render (see `render.yaml`).
*   **Running**: `cd right-here-right-now && pnpm dev` (Runs on port 3000 by default).

### 10. Whovian Degrees (`whovian_degrees/`)
A Doctor Who trivia game.
*   **Features**: Challenges users to connect various actors to the Doctor, using the Gemini API to verify and provide context for the connections.
*   **Running**: `cd whovian_degrees && python3 whovian_degrees_app.py` (Runs on port 5005 by default).

### 11. Crossover Size Converter (`crossover_size_converter/`)
A single-page clothing and shoe size converter.
*   **Features**: Converts sizes between men's and women's ranges and across UK, US, EU, French, Italian, Japanese and letter sizing, from a shared set of body measurements. Includes an at-a-glance summary of your sizes, a mystery-label decoder, a checker for "pit to pit" style listing measurements, and a whole-body fit check for swimwear and bodysuits. Everything runs in the browser and settings are remembered with `localStorage`; there is no backend.
*   **Running**: Open `crossover_size_converter/index.html` directly in a browser, or serve it with `python3 -m http.server 8013 --directory crossover_size_converter`. It is deployed on Render as a static site (see `render.yaml`) and served on port 8013 by `docker compose up`.

### 12. ASHWGA Cliché Bingo (`ashwga/`)
Satirical bingo for things you can see coming a mile off. The name is short for "Ah Shit, Here We Go Again".
*   **Features**: Twelve starter decks of about 50 squares each (Game Showcase, Live Streamer, Wrestling Promo, Open-World Game, Award Show, Video Essay, Girl Talk, Patch Notes, Sports Pundit, Reality TV, TED-Style Talk, Tech Keynote) dealt as random 5×5 cards. Square sizes adapt to their text: wordier columns get more width, rows grow to fit, and long words are never split mid-word on most screens. Tap squares as the clichés happen. The page detects lines and a full house, makes squares that would finish a line glow, and times the run. "Copy card link" sends a friend the exact same card, "Share result" copies an emoji grid, and "Make your own card" builds a custom deck that travels in the link. "Edit squares" lists every square in the deck: swap any square off your card, put a particular one on it, remove squares from the deck, or add your own. Deck edits are kept in the browser, and an edited card's link carries its squares, so a friend gets exactly that card. Close enough counts: squares marked ≈ list other wordings of the same cliché (press and hold, hover, or press `?`), and custom or added squares can list their own after a `|`. Everything runs in the browser and marks are remembered with `localStorage`; there is no backend. Decks live in `ashwga/cards.js`; the product spec and roadmap are in `ashwga/SPEC.md`.
*   **Running**: Open `ashwga/index.html` directly in a browser, or serve it with `python3 -m http.server 8014 --directory ashwga`. It is deployed on Render as a static site (see `render.yaml`) and served on port 8014 by `docker compose up`.
*   **Testing**: Browser tests (gameplay, editing, variations, layout and WCAG 2.2 AA accessibility) live in `tools/ashwga-tests/`; run `npm ci && npx playwright test` there. CI runs them on pull requests that touch `ashwga/`.

### 13. Point It Out (`point_it_out/`)
A picture quiz where you answer by pointing, a cousin of Where In The World.
*   **Features**: Each question shows one or more pictures. Players click the right picture or the right part of it, can move their pin before locking it in, and score 10 points for a hit or 5 for a near miss. Questions can be grouped into sets that share pictures (four related pictures, or one busy picture) and are played back to back. Questions come from `Point It Out.csv` (category, question, pictures, correct picture, an optional answer area as left/top/width/height percentages, and an explanation); pictures live in `static/images`. A question maker at `/editor` lets you pick pictures, drag a box over the answer and copy the finished CSV line. Pins can be placed and moved from the keyboard. A quiz night mode has teams take turns, with a per-question timer and a scoreboard.
*   **Running**: `cd point_it_out && python3 point_it_out_app.py` (Runs on port 5010 by default; port 8015 under `docker compose up`).

### 14. TV Link (`tv_link/`)
Put things on any TV that has a web browser, from your phone. No app to install on the TV or the phone, and no casting protocol to fight with: if the TV can open a web page, it works.
*   **Connecting**: open `/tv` in the TV's browser. It shows a five-letter code and a QR code. On a phone, scan the QR code or open `/` and type the code. Any number of phones can connect to one TV. **New code** on the TV disconnects every phone. The TV keeps its code if it's reloaded, and a screen ends an hour after the TV stops checking in.
*   **What you can show**: photos from the phone (shrunk to 1080p and sent as JPEG, then tapped to show, stepped through, or played as a slideshow that moves on by itself); a message in text as large as fits; a YouTube video from any watch, youtu.be, Shorts or live link (with play/pause, mute, restart and stop from the phone); a countdown timer (presets or any time, with pause, resume and +30 s); a clock; or a blank screen. The **Code screen** button puts the code back up so someone else can join.
*   **Older TVs**: the TV page is ES5 with XMLHttpRequest polling and flexbox without gap, checked with `npm run check:tv` in `tools/frontend` like the quiz boards.
*   **Limits**: everything is held in memory: up to 40 photos and 60 MB per TV, 400 MB across the server, and 300 TVs at once. Wrong codes from one address are limited to 20 every 10 minutes so codes can't be guessed. Video is YouTube only (embedded through youtube-nocookie.com); the TV's own browser decides whether a video can start with sound before someone presses OK on the TV remote.
*   **Running**: `cd tv_link && pip install -r requirements.txt && python3 tv_link_app.py` (runs on port 5000 by default; port 8016 under `docker compose up`). The QR code needs `segno`; without it the TV still shows the code.

## Tech Stack

Most applications in this repository share a similar underlying architecture, with one exception:
*   **Backend**: Python 3.6+ with the Flask web framework (except the Next.js app).
*   **Frontend**: Standard HTML, CSS, and Vanilla JavaScript (using Jinja2 templating). The Next.js app uses React and Tailwind CSS.
*   **Data Storage**: Local CSV files or parsed PDF data (depending on the app). Mutable usage state for flashcard apps is tracked via an SQLite database (defaulting to `state.db` via the `DB_FILE` environment variable) to keep CSVs read-only. Caching is implemented for performance optimizations.

## Installation and Setup

To get started, clone the repository and install the dependencies.

### Flask Applications
It is recommended to use a virtual environment for the Python-based Flask applications. Each application has its own `requirements.txt` file.

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>

# Install dependencies for a specific app (e.g., pdf_grid_flashcards)
pip install -r pdf_grid_flashcards/requirements.txt

# Or install dependencies for all apps you intend to use
pip install -r mcq_flashcards/requirements.txt
pip install -r trivia_flashcards/requirements.txt
# ... and so on
```

### Next.js Application (`right-here-right-now`)
The Next.js dashboard application requires Node.js and `pnpm`.

```bash
# Navigate to the Next.js app directory
cd right-here-right-now

# Install Node dependencies
pnpm install

# Run the development server
pnpm dev
```

### Shared portal bar
Every Flask app shows the same bar at the top: "Trivial Things" and an "All apps" link back to the portal. Its canonical files are in `shared/portal_nav/` (a Jinja partial, a stylesheet and a small script). Each app is deployed from its own directory, so each keeps a copy: edit the files in `shared/portal_nav/`, then run `python3 tools/sync_shared.py` to update the copies (it also copies the Quiz Night files below). To use it, a page includes `_portal_nav.html` and links `css/portal-nav.css` in its `<head>` (see any app's `templates/index.html` for an example); if the page's `<body>` has padding, set `--portal-nav-inset` to that padding so the bar spans the page. `test_portal_nav.py` fails if a copy is out of date.

### Quiz Night look
The eight quiz apps (Trivia, MCQ, Sliding Rows, What The Spell, PDF Grid, Point It Out, Where In The World and the Scoreboard) share one look, built to read well on a projector or TV: a dark stage, large text that grows with the screen, and the Atkinson Hyperlegible font (self-hosted, OFL licence). The shared stylesheet is `shared/quiz_night/quiz-night.css`, copied into each app by `python3 tools/sync_shared.py` like the portal bar. Each page loads it before its own `style.css` and gives `<body>` the class `quiz-night`; each app picks its own colour with `--qn-accent` in its `style.css`.

Buttons mean the same thing in every app:
*   `qn-go` (the app's colour): the main forward action, such as Start, Next, Submit or Upload.
*   `qn-skip` (grey): move on without changing anything, such as Skip.
*   `qn-eliminate` (red): remove something, such as Eliminate & Next.
*   `qn-reset` (outlined): admin and housekeeping, such as Reset All.

Green and red are kept for right and wrong answers. `test_quiz_night.py` checks every quiz page uses the shared look and that no two apps share a colour.

### Prebuilt front-end files
Periodic Name, Price Time Machine, Quarterly Calendar and Whovian Degrees use Tailwind CSS, and Whovian Degrees is a small React app. Their CSS, React and compiled JSX are built ahead of time and committed, so no app loads anything from a CDN when it runs. After changing Tailwind classes in those apps, or Whovian's `src/*.jsx`, rebuild with:

```bash
cd tools/frontend && npm ci && ./build.sh
```

Each of those apps has a `tailwind.config.js` listing the files to scan. The same folder also checks What The Spell's board against older smart-TV browsers with `npm run check:tv` (see `what_the_spell/README.md`). `test_no_external_assets.py` fails if any app page loads a script or stylesheet from another site.

### Phone remote

Trivia Flashcards, MCQ Flashcards, Sliding Rows and What The Spell can be run from the quizmaster's phone while the board is on a TV, so the room doesn't see answers early:

1. On your phone, open the app's `/host` page and tap **Start a remote**. It shows a four-letter code.
2. On the TV, open the app and choose **Use a phone as the remote**, then type the code (or open the `/?remote=CODE` link the phone shows).
3. The phone shows the answers and has the buttons; the TV shows only what you've revealed.

| App | The TV shows | The phone adds |
| --- | --- | --- |
| Trivia Flashcards | the question | the answer; Show answer on TV, Skip, Eliminate, Reset |
| MCQ Flashcards | the question and its choices | which choice is right; tap the team's pick, then Show answer on TV |
| Sliding Rows | each row once you show it | every question and answer; Show question / Show answer per row, Next chain |
| What The Spell | which tile is chosen | the word and its spelling; Show on TV (each remote also shuffles the grid) |

The server never sends the TV an answer before it's shown, so it can't be read from the TV's page either, and only the phone that started the remote can control it. Skip, Eliminate, Reset and finished chains update the same used/unused state as the board's own buttons. Remotes live in each app's memory and end after 12 idle hours or a restart.

The shared code is in `shared/remote/` (server, TV and phone scripts, styles and template partials) and is copied into the flashcard apps by `python3 tools/sync_shared.py`; What The Spell keeps its own earlier version. Each app adds a small *game* class that decides what the TV may see. On the TV the boards are written for older smart-TV browsers and checked with `npm run check:tv` in `tools/frontend` (see "Smart TVs" in `what_the_spell/README.md` for TVs without a browser).

*Note: Ensure you are running each application from within its respective directory so that it can locate its associated data files and dependencies correctly.*
