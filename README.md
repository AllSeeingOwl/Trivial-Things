# Trivia and Flashcards Apps

Welcome to the Trivia and Flashcards repository! This collection features four interactive, web-based applications designed to help you study, run trivia nights, or play educational games. Each application focuses on a unique style of learning and questioning.

## The Applications

The repository is organized into four distinct Flask applications:

### 1. Trivia Flashcards (`trivia_flashcards/`)
A flashcard web app perfect for classic trivia and quiz games.
*   **Features**: Randomizes questions from a CSV file (`Questions & All That.csv`), presenting a "front" (question) and a "back" (answer). You can eliminate questions as they are asked, ensuring they won't repeat, with state saved back directly to the CSV.
*   **Running**: `cd trivia_flashcards && python3 app.py` (Runs on port 5000 by default).

### 2. MCQ Flashcards (`mcq_flashcards/`)
A multiple-choice variant of the trivia flashcards.
*   **Features**: Reads from `MCQ Questions.csv` and presents four randomized choices per question. Includes visual feedback for correct/incorrect choices before revealing the back of the card. State is also saved to prevent repeats.
*   **Running**: `cd mcq_flashcards && python3 app.py` (Runs on port 5000 by default).

### 3. What The Spell (`what_the_spell/`)
A spelling-focused interactive grid application.
*   **Features**: Parses spelling grids from `What The Spell.csv` and displays them via a slick interface. Uses in-memory caching for speedy grid loading.
*   **Running**: `cd what_the_spell && python3 app.py` (Runs on port 5001 by default).

### 4. PDF Grid Flashcards (`pdf_grid_flashcards/`)
An application that generates interactive grid views by parsing structured PDFs.
*   **Features**: Upload a PDF (like a crossword or grid puzzle), and the app uses PyMuPDF (`fitz`) to extract text and colored regions, rendering an interactive HTML grid where you can verify correct/incorrect cells.
*   **Running**: `cd pdf_grid_flashcards && python3 app.py` (Runs on port 5002 by default).

## Tech Stack

All applications in this repository share a similar underlying architecture:
*   **Backend**: Python 3.6+ with the Flask web framework.
*   **Frontend**: Standard HTML, CSS, and Vanilla JavaScript (using Jinja2 templating).
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
