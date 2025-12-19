#!/bin/bash
# Test backend connectivity

SERVER_IP=$(hostname -I | awk '{print $1}')

echo "🔍 Testing DataPay Backend Connectivity"
echo "========================================"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s http://localhost:8000/health | jq '.' || echo "❌ Health check failed"
echo ""

# Test from network
echo "2. Testing from network IP..."
curl -s http://$SERVER_IP:8000/health | jq '.' || echo "❌ Network access failed"
echo ""

# Check if ports are open
echo "3. Checking open ports..."
netstat -tuln | grep -E ':(8000|5432|9000|6379)' || echo "⚠️  Some ports may not be open"
echo ""

# Show firewall status
echo "4. Checking firewall (if applicable)..."
if command -v ufw &> /dev/null; then
    sudo ufw status | grep 8000 || echo "⚠️  Port 8000 may not be open in firewall"
fi

echo ""
echo "📝 Connection Info for Extension:"
echo "   API URL: http://$SERVER_IP:8000"
echo ""
echo "🧪 Test from your Windows laptop:"
echo "   curl http://$SERVER_IP:8000/health"
echo ""

