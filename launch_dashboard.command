#!/bin/bash
# Double-click this file to launch the Blog Dashboard
# First time: right-click → Open (to bypass Gatekeeper)

cd "$(dirname "$0")"

# Install dependencies if needed
python3 -c "import flask, anthropic, dotenv" 2>/dev/null || {
  echo "Installing dependencies..."
  pip3 install -r requirements.txt
}

echo ""
echo "Starting Blog Dashboard..."
python3 dashboard.py
