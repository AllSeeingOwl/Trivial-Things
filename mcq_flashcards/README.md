# MCQ Flashcards

A multiple-choice variant of the Trivia Flashcards web application designed for trivia/quiz games.

Unlike other flashcard apps, this app randomizes the questions from your spreadsheet (CSV) and presents them as multiple-choice questions. When a question is used, it can be "eliminated" (marked as used) to ensure it does not repeat.

## Features

- Reads questions directly from a standard `MCQ Questions.csv` spreadsheet.
- Displays up to 4 choices for each question, visually validating correct/incorrect answers before revealing the back of the card.
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
2. Make sure your `MCQ Questions.csv` file is in the root directory.

### CSV Format

The `MCQ Questions.csv` file should contain the following columns in order:
`Question`, `Correct Answer`, `Wrong 1`, `Wrong 2`, `Wrong 3`, `USED`

Make sure the top row is exactly `Question,Correct Answer,Wrong 1,Wrong 2,Wrong 3,USED`.

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
