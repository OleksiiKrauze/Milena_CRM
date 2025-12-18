#!/bin/bash
# Database backup script

BACKUP_DIR="/data/backups/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/crm_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Run pg_dump inside Docker container
docker exec crm_db pg_dump -U crm_user_prod crm_production > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
    # Compress backup
    gzip $BACKUP_FILE

    # Delete backups older than 7 days
    find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

    echo "Backup completed successfully: ${BACKUP_FILE}.gz"
else
    echo "ERROR: Backup failed!"
    exit 1
fi
