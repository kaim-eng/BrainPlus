#!/bin/bash
# Start the FastAPI server

set -e

echo "🚀 Starting DataPay API Server..."

# Activate virtual environment
source venv/bin/activate

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "🌐 Server will be accessible at:"
echo "   http://$SERVER_IP:8000"
echo "   http://localhost:8000 (on this machine)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start uvicorn with network binding
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

