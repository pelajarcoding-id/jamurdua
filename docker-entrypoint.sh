#!/bin/sh

# Wait for DB to be ready
echo "Waiting for database to be ready..."
# npx prisma db push --accept-data-loss # Warning: This might lose data in some cases
npx prisma migrate deploy

# Start the application
echo "Starting application..."
exec node server.js
