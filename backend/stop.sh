#!/bin/bash
# Stop all backend services

echo "🛑 Stopping DataPay Backend..."

# Stop Docker containers
docker-compose down

echo "✅ All services stopped"

