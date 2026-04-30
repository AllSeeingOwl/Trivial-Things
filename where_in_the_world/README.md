# Where In The World

A Flask web application that presents a geography guessing game based on a CSV file of locations.

## Features

- Reads location data from a CSV file (`Where In The World Is.csv` by default).
- Presents random locations for the user to guess.
- Calculates the score based on the distance between the guessed location and the actual target.
- Interactive map interface (powered by Leaflet/OpenStreetMap).

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
python app.py
```

By default, the server runs on port `5004` (configurable via the `PORT` environment variable).

Then open your browser and go to:
[http://127.0.0.1:5004](http://127.0.0.1:5004)

## Usage

- The game will present a location to find.
- Click on the interactive map to make your guess.
- The app will calculate your score based on how close your guess was to the actual location.
