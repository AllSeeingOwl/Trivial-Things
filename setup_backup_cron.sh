#!/bin/bash

# Define the path to the backup script
# Assumes setup_backup_cron.sh and backup.sh are in the same directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"

# Ensure the backup script is executable
chmod +x "$BACKUP_SCRIPT"

# Ensure the backups directory exists so cron logs don't fail
mkdir -p "${SCRIPT_DIR}/backups"

# Define the cron job command (runs every week on Sunday at 2 AM)
# Cron schedule: 0 2 * * 0 (Minute: 0, Hour: 2, Day of month: *, Month: *, Day of week: 0 [Sunday])
CRON_SCHEDULE="0 2 * * 0"
CRON_CMD="${BACKUP_SCRIPT} > ${SCRIPT_DIR}/backups/backup_cron.log 2>&1"
CRON_JOB="${CRON_SCHEDULE} ${CRON_CMD}"

# Check if the cron job already exists to avoid duplicates
(crontab -l 2>/dev/null | grep -F "$BACKUP_SCRIPT") >/dev/null
if [ $? -eq 0 ]; then
    echo "Backup cron job already exists!"
else
    # Add the new cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    if [ $? -eq 0 ]; then
        echo "Successfully set up weekly backup cron job."
        echo "Schedule: Every Sunday at 2:00 AM"
    else
        echo "Failed to set up cron job." >&2
        exit 1
    fi
fi
