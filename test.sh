#!/bin/bash

# BrainPlus Sync - Quick Test Setup Script

echo "============================================================"
echo "BrainPlus Cross-Device Sync - Quick Test Setup"
echo "============================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Step 1: Install signaling server dependencies
echo "Step 1: Installing signaling server dependencies..."
cd signaling-server
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install signaling server dependencies"
        exit 1
    fi
fi
echo "✅ Signaling server dependencies installed"
echo ""

# Step 2: Install extension dependencies
echo "Step 2: Installing extension dependencies..."
cd ../extension
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install extension dependencies"
        exit 1
    fi
fi
echo "✅ Extension dependencies installed"
echo ""

# Step 3: Build extension
echo "Step 3: Building extension..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build extension"
    exit 1
fi
echo "✅ Extension built successfully"
echo ""

# Step 4: Install native host dependencies
echo "Step 4: Installing native host dependencies..."
cd ../native-host
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install native host dependencies"
        exit 1
    fi
fi
echo "✅ Native host dependencies installed"
echo ""

cd ..

echo "============================================================"
echo "✅ Setup Complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the signaling server:"
echo "   cd signaling-server && npm start"
echo ""
echo "2. Load the extension in Chrome:"
echo "   - Go to chrome://extensions"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $(pwd)/extension/dist"
echo ""
echo "3. Install native host (copy Extension ID first):"
echo "   cd native-host"
echo "   node install-manifest.js YOUR_EXTENSION_ID"
echo ""
echo "4. Follow the testing guide:"
echo "   See TESTING_GUIDE.md for detailed instructions"
echo ""
echo "============================================================"
echo "Happy Testing! 🚀"
echo "============================================================"

