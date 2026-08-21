#!/bin/bash
set -e

# Render mounts the persistent disk at /var/data
DB_DIR="/var/data"
DB_PATH="$DB_DIR/alatas.db"

# Set the environment variable so sqlite-db.js knows where to put the db
export ALATAS_DATA_DIR=$DB_DIR

# 1. Restore the database from R2 if it doesn't exist on the disk
if [ ! -f "$DB_PATH" ]; then
  echo "Database not found. Attempting to restore from Cloudflare R2..."
  ./litestream restore -v -if-replica-exists -o $DB_PATH s3://$R2_BUCKET_NAME/db
  echo "Restore process finished."
fi

# 2. Start Litestream to replicate data in the background, 
# and use the -exec flag to start your Express app!
echo "Starting Litestream and Express backend..."
exec ./litestream replicate -config litestream.yml -exec "npm start"
