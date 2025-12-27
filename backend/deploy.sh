#!/bin/bash
# BrainPlus Backend Deployment Script for Linux Server

set -e  # Exit on error

echo "🚀 BrainPlus Backend Deployment"
echo "=================================="

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  Warning: Running as root. Consider using a non-root user."
fi

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Check Python installation
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.8+."
    exit 1
fi

echo "✅ Docker and Python found"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    
    # Get server IP address
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    # Create .env file
    cat > .env << EOF
# BrainPlus Backend Configuration

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_BASE_URL=http://${SERVER_IP}:8000

# Database - PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=datapay
POSTGRES_PASSWORD=datapay_dev_password_$(date +%s)
POSTGRES_DB=datapay

# Authentication
SECRET_KEY=dev_secret_key_$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Payout Partner (Leave empty for testing)
TREMENDOUS_API_KEY=
TREMENDOUS_API_URL=https://testflight.tremendous.com/api/v2

# CORS (Allow all for testing)
CORS_ORIGINS=["*"]

# Environment
ENVIRONMENT=development
DEBUG=true
EOF
    
    echo "✅ .env file created"
    echo ""
    echo "🌐 Detected server IP: $SERVER_IP"
    echo "📝 API URL set to: http://$SERVER_IP:8000"
    echo ""
    echo "⚠️  Note: Auto-generated passwords for development."
    echo "   For production, edit .env and set stronger credentials."
    echo ""
    read -p "Press Enter to continue..."
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose down
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 10

# Check container status
echo ""
echo "🔍 Container Status:"
docker-compose ps

# Get server info
echo ""
echo "✅ Backend deployment complete!"
echo ""
echo "📍 Server Information:"
echo "   IP Address: $(hostname -I | awk '{print $1}')"
echo "   Hostname: $(hostname)"
echo ""
echo "🔗 Access Points:"
echo "   API: http://$(hostname -I | awk '{print $1}'):8000"
echo "   API Docs: http://$(hostname -I | awk '{print $1}'):8000/docs"
echo "   Health Check: http://$(hostname -I | awk '{print $1}'):8000/health"
echo ""
echo "📝 Next Steps:"
echo "   1. Start the API server: ./start_api.sh"
echo "   2. Test the connection from your laptop"
echo "   3. Configure the extension with this API URL"
echo ""

