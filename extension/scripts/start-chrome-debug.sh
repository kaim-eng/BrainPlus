#!/bin/bash
# Start Chrome with Remote Debugging for Log Watching
# This makes it easy to use the auto-export log watcher

BROWSER="${1:-chrome}"  # Options: chrome, brave, edge
PORT="${2:-9222}"

echo "🚀 Starting $BROWSER with Remote Debugging..."
echo ""

USER_DATA_DIR="/tmp/$BROWSER-debug-$(date +%Y%m%d)"

# Find browser executable
case "$BROWSER" in
    chrome)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            BROWSER_EXE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        else
            BROWSER_EXE=$(which google-chrome || which google-chrome-stable || which chrome)
        fi
        ;;
    brave)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            BROWSER_EXE="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        else
            BROWSER_EXE=$(which brave || which brave-browser)
        fi
        ;;
    edge)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            BROWSER_EXE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        else
            BROWSER_EXE=$(which microsoft-edge || which edge)
        fi
        ;;
    *)
        echo "❌ Unknown browser: $BROWSER"
        echo ""
        echo "Usage: ./start-chrome-debug.sh [chrome|brave|edge] [port]"
        exit 1
        ;;
esac

if [ ! -f "$BROWSER_EXE" ] && [ ! -x "$BROWSER_EXE" ]; then
    echo "❌ $BROWSER not found!"
    echo ""
    echo "Please install $BROWSER or specify a different browser:"
    echo "  ./start-chrome-debug.sh chrome"
    echo "  ./start-chrome-debug.sh brave"
    echo "  ./start-chrome-debug.sh edge"
    exit 1
fi

echo "✅ Found: $BROWSER_EXE"
echo "📁 User data dir: $USER_DATA_DIR"
echo "🔌 Debug port: $PORT"
echo ""

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use!"
    echo "   A debug instance might already be running."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Start browser
echo "🌐 Launching $BROWSER..."
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIST_DIR="$SCRIPT_DIR/../dist"

"$BROWSER_EXE" \
    --remote-debugging-port=$PORT \
    --user-data-dir="$USER_DATA_DIR" \
    --disable-extensions-except="$DIST_DIR" \
    --load-extension="$DIST_DIR" \
    > /dev/null 2>&1 &

sleep 2

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ $BROWSER started successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Load your extension in $BROWSER"
    echo "   2. In a new terminal, run: npm run watch-logs"
    echo "   3. Logs will auto-export to EXTENSION_LOGS.txt"
    echo ""
    echo "🔍 Debug info:"
    echo "   - Debug port: http://localhost:$PORT"
    echo "   - View targets: http://localhost:$PORT/json"
    echo ""
else
    echo "❌ Failed to start $BROWSER!"
    exit 1
fi

