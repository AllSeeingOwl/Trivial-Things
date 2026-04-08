#!/bin/bash

# Define the root of the repository
# We assume the script is run from the repo root or inside it.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Define backup directory and filename
BACKUP_DIR="${REPO_ROOT}/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/repo_backup_${TIMESTAMP}.tar.gz"

# Create the backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup of ${REPO_ROOT}..."

# Create the tar.gz archive, excluding unnecessary directories and the backups directory itself
tar -czf "$BACKUP_FILE" \
    --exclude=".git" \
    --exclude="venv" \
    --exclude="__pycache__" \
    --exclude="*.pyc" \
    --exclude="backups" \
    -C "$REPO_ROOT" .

if [ $? -eq 0 ]; then
    echo "Backup successfully created: $BACKUP_FILE"
else
    echo "Backup failed!" >&2
    exit 1
fi
