#!/bin/bash
set -e

# Persistent disk on Render is usually /var/data; fall back to ./sqlite for smoke tests.
DB_DIR="${ALATAS_DATA_DIR:-/var/data}"
if [ ! -d "$DB_DIR" ]; then
  echo "[start] $DB_DIR not mounted — using ./sqlite"
  DB_DIR="$(pwd)/sqlite"
fi
mkdir -p "$DB_DIR"
export ALATAS_DATA_DIR="$DB_DIR"
DB_PATH="$DB_DIR/alatas.db"

has_r2=false
if [ -n "${R2_BUCKET_NAME:-}" ] && [ -n "${R2_ENDPOINT:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  has_r2=true
fi

if [ "$has_r2" = true ] && [ -x "./litestream" ]; then
  if [ ! -f "$DB_PATH" ]; then
    echo "[start] Restoring database from R2 (if replica exists)..."
    ./litestream restore -v -if-replica-exists -o "$DB_PATH" "s3://${R2_BUCKET_NAME}/db" || true
  fi
  echo "[start] Litestream + Express..."
  exec ./litestream replicate -config litestream.yml -exec "npm start"
fi

echo "[start] Express only (R2/Litestream not configured)..."
exec npm start
