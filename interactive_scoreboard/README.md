# Interactive Scoreboard

A standalone interactive scoreboard application that allows users to track scores, view rankings, calculate player statistics, and export data. It features both a web UI for manual input and API endpoints for automated digital recording.

## Features

- **Ranked Scoreboard:** View entries ranked dynamically by score.
- **Player Statistics:** Automatically calculates Total Games Played, Average Score, High Score, and Recent Activity per player.
- **Manual Input Form:** Add entries via a web-based form.
- **API Endpoints:** Submit and fetch data programmatically.
- **CSV Export:** Download a physical backup of the digital scoreboard records.
- **Persistent Storage:** Uses a SQLite database ensuring data persists across server restarts.
- **Release Ready:** Packaged with a Dockerfile, standard `requirements.txt`, and uses environment variables for configuration.

## Setup and Installation

### Prerequisites
- Python 3.9+
- or Docker

### Running Locally (Python)

1. Navigate to the application directory:
   ```bash
   cd interactive_scoreboard
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python scoreboard_app.py
   ```
   By default, the application runs on `http://localhost:5000`.

### Running with Docker

1. Build the Docker image:
   ```bash
   docker build -t interactive-scoreboard .
   ```

2. Run the Docker container:
   ```bash
   docker run -p 5000:5000 interactive-scoreboard
   ```

## Configuration

The application can be configured using environment variables:

- `PORT`: The port the Flask app binds to (default: `5000`).
- `HOST`: The host address the Flask app binds to (default: `0.0.0.0`).
- `DATABASE_URI`: The SQLAlchemy database URI (default: `sqlite:///scoreboard.db` stored in the app directory).

## API Documentation

- `GET /api/scores`: Retrieve all scoreboard entries.
- `POST /api/scores`: Add a new entry. Expects JSON payload: `{"player_name": "...", "score": 100, "time_taken": 120, "avatar_url": "..."}`.
- `GET /api/stats`: Retrieve calculated statistics for each player.
- `GET /api/export`: Downloads the scoreboard data as a CSV file.
