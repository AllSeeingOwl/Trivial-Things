# Whovian Degrees

A Flask web application that acts as a Doctor Who trivia game, utilizing the Gemini API to connect actors to the Doctor.

## Features

- Challenges users to connect various actors to the Doctor.
- Uses the Gemini API to verify and provide context for the connections.
- Interactive and engaging web interface.

## Requirements

- Python 3.6+
- Flask
- Gemini API Key

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Obtain a Gemini API Key from Google AI Studio.
3. Set the `GEMINI_API_KEY` environment variable:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```

## Running the App

Start the Flask server:
```bash
python app.py
```

By default, the server runs on port `5005` (configurable via the `PORT` environment variable).

Then open your browser and go to:
[http://127.0.0.1:5005](http://127.0.0.1:5005)

## Usage

- The app will present a challenge to connect an actor to a specific Doctor.
- Enter your guesses and reasoning.
- The app will use the Gemini API to evaluate your answer and provide feedback.
