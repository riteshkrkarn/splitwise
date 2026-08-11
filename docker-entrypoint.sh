#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR/uploads/receipts"

# Persist receipt uploads on the Railway volume across deploys.
rm -rf /app/public/uploads
ln -sfn "$DATA_DIR/uploads" /app/public/uploads

export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/splitwise.db}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

exec npx next start --hostname "$HOSTNAME" --port "$PORT"
