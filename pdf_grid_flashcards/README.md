# PDF Grid Flashcards

A Flask web application that extracts text from PDF grids and turns them into interactive flashcards.

## Features

- Upload a PDF containing grids of text.
- Parses the PDF and groups the text into a structured grid format.
- Displays the extracted data as interactive flashcards on a web interface.

## Requirements

- Python 3.6+
- Flask
- PyMuPDF
- Werkzeug

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the App

Start the Flask server:
```bash
python app.py
```

By default, the server runs on port `5002` (configurable via the `PORT` environment variable).

Then open your browser and go to:
[http://127.0.0.1:5002](http://127.0.0.1:5002)

## Usage

1. Click the file upload button and select a PDF file.
2. Submit the form.
3. The app will process the PDF and display the flashcards on the screen.
