#!/bin/sh

# Simple dev server for TRMNL dashboards

# Use Python 3's http.server for static serving
# Default to port 8000, or use $1 if provided
PORT=${1:-8000}

cd "$(dirname "$0")"
echo "Starting dev server at http://localhost:$PORT"
python3 -m http.server $PORT
