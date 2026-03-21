# Trivia Flashcards

A flashcard-like web application designed for trivia/quiz games.

Unlike other flashcard apps, this app randomizes the questions from your spreadsheet (CSV) to keep things fresh. When a question is used, it can be "eliminated" (marked as used) to ensure it does not repeat.

## Features

- Reads questions directly from a standard `Questions & All That.csv` spreadsheet containing a "Set A" and "Set B".
- Eliminating a question writes `TRUE` directly to the CSV under the "USED" column, saving the state across restarts.
- Beautiful, intuitive flip-card frontend interface.
- Skip questions you want to keep in the pool or eliminate them once asked.
- Instantly reset all used questions with the press of a button.

## Requirements

- Python 3.6+
- Flask

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Make sure your `Questions & All That.csv` file is in the root directory.

## Running the App

Start the Flask server:
```bash
python app.py
```

Then open your browser and go to:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

## How to Play

- **Click the card**: Flips the card over to reveal the answer.
- **Skip (Keep)**: Moves to a new random question without marking the current one as used.
- **Eliminate & Next**: Marks the current question as "USED" in the CSV and brings up a new random question.
- **Reset All Questions**: Changes all "USED" questions back to `FALSE` in the CSV, making them available again.
