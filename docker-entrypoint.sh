#!/bin/sh

set -e

echo "Waiting for database to be ready..."

i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not ready after multiple attempts."
    exit 1
  fi
  echo "Database not ready yet, retrying..."
  sleep 2
done

echo "Starting application..."
exec "$@"
