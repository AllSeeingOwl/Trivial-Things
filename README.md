# Trivia and Flashcards Apps

Welcome to the Trivia and Flashcards repository! This collection features twelve interactive, web-based applications designed to help you study, run trivia nights, or play educational games. Each application focuses on a unique style of learning and questioning.

## The Applications

The repository is organized into twelve distinct applications (nine Flask, one Next.js, two static HTML pages):

### 1. Trivia Flashcards (`trivia_flashcards/`)
A flashcard web app perfect for classic trivia and quiz games.
*   **Features**: Randomizes questions from a CSV file (`Questions & All That.csv`), presenting a "front" (question) and a "back" (answer). You can eliminate questions as they are asked, ensuring they won't repeat, with state tracked via an SQLite database.
*   **Running**: `cd trivia_flashcards && python3 trivia_flashcards_app.py` (Runs on port 5000 by default).

### 2. MCQ Flashcards (`mcq_flashcards/`)
A multiple-choice variant of the trivia flashcards.
*   **Features**: Reads from `MCQ Questions.csv` and presents four randomized choices per question. Includes visual feedback for correct/incorrect choices before revealing the back of the card. State is also saved via an SQLite database to prevent repeats.
*   **Running**: `cd mcq_flashcards && python3 mcq_flashcards_app.py` (Runs on port 5000 by default).

### 3. What The Spell (`what_the_spell/`)
A spelling-focused interactive grid application.
*   **Features**: Parses spelling grids from `What The Spell.csv` and displays them via a slick interface. Uses in-memory caching for speedy grid loading.
*   **Running**: `cd what_the_spell && python3 what_the_spell_app.py` (Runs on port 5001 by default).

### 4. PDF Grid Flashcards (`pdf_grid_flashcards/`)
An application that generates interactive grid views by parsing structured PDFs.
*   **Features**: Upload a PDF (like a crossword or grid puzzle), and the app uses PyMuPDF (`fitz`) to extract text and colored regions, rendering an interactive HTML grid where you can verify correct/incorrect cells.
*   **Running**: `cd pdf_grid_flashcards && python3 pdf_grid_flashcards_app.py` (Runs on port 5002 by default).

### 5. Sliding Rows Flashcards (`sliding_rows_flashcards/`)
An application that presents sliding rows of flashcards and segues.
*   **Features**: Reads data from `Questions_And_Segues.csv` to provide a unique flashcard learning experience. State is tracked via an SQLite database.
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

*Note: Ensure you are running each application from within its respective directory so that it can locate its associated data files and dependencies correctly.*
