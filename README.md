# Trivia and Flashcards Apps

Welcome to the Trivia and Flashcards repository! This collection features ten interactive, web-based applications designed to help you study, run trivia nights, or play educational games. Each application focuses on a unique style of learning and questioning.

## The Applications

The repository is organized into ten distinct applications (nine Flask, one Next.js):

### 1. Trivia Flashcards (`trivia_flashcards/`)
A flashcard web app perfect for classic trivia and quiz games.
*   **Features**: Randomizes questions from a CSV file (`Questions & All That.csv`), presenting a "front" (question) and a "back" (answer). You can eliminate questions as they are asked, ensuring they won't repeat, with state saved back directly to the CSV.
*   **Running**: `cd trivia_flashcards && python3 trivia_flashcards_app.py` (Runs on port 5000 by default).

### 2. MCQ Flashcards (`mcq_flashcards/`)
A multiple-choice variant of the trivia flashcards.
*   **Features**: Reads from `MCQ Questions.csv` and presents four randomized choices per question. Includes visual feedback for correct/incorrect choices before revealing the back of the card. State is also saved to prevent repeats.
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
*   **Features**: Reads data from `Questions_And_Segues.csv` to provide a unique flashcard learning experience.
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
*   **Features**: Uses Tailwind CSS, native CSS columns for a Pinterest-like masonry layout, and Vercel Cron to trigger daily API routes.
*   **Running**: `cd right-here-right-now && pnpm dev` (Runs on port 3000 by default).

### 10. Whovian Degrees (`whovian_degrees/`)
A Doctor Who trivia game.
*   **Features**: Challenges users to connect various actors to the Doctor, using the Gemini API to verify and provide context for the connections.
*   **Running**: `cd whovian_degrees && python3 whovian_degrees_app.py` (Runs on port 5005 by default).

## Tech Stack

Most applications in this repository share a similar underlying architecture, with one exception:
*   **Backend**: Python 3.6+ with the Flask web framework (except the Next.js app).
*   **Frontend**: Standard HTML, CSS, and Vanilla JavaScript (using Jinja2 templating). The Next.js app uses React and Tailwind CSS.
*   **Data Storage**: Local CSV files or parsed PDF data (depending on the app). Caching is implemented for performance optimizations.

## Installation and Setup

To get started, clone the repository and install the dependencies. It's recommended to use a virtual environment.

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>

# Install the Python dependencies
pip install -r mcq_flashcards/requirements.txt
pip install -r trivia_flashcards/requirements.txt
# (Additional requirements like PyMuPDF for pdf_grid_flashcards may be required, install via `pip install PyMuPDF`)
```

*Note: Ensure you are running each application from within its respective directory so that it can locate its associated CSV data files correctly.*
