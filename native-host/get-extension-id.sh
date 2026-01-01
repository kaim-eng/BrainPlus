#!/bin/bash

# Helper script to find BrainPlus extension ID on Chrome OS

echo "Looking for BrainPlus extension ID..."
echo ""

# Check Chrome extensions directory
CHROME_DIR="$HOME/.config/google-chrome/Default/Extensions"

if [ ! -d "$CHROME_DIR" ]; then
    echo "❌ Chrome extensions directory not found"
    exit 1
fi

echo "Searching in: $CHROME_DIR"
echo ""

# Look for manifest files containing "brainplus" (case insensitive)
found=0
for ext_dir in "$CHROME_DIR"/*; do
    if [ -d "$ext_dir" ]; then
        ext_id=$(basename "$ext_dir")
        
        # Look in version subdirectories
        for version_dir in "$ext_dir"/*; do
            if [ -f "$version_dir/manifest.json" ]; then
                # Check if manifest contains "brainplus" or "BrainPlus"
                if grep -qi "brainplus" "$version_dir/manifest.json" 2>/dev/null; then
                    name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$version_dir/manifest.json" | head -1 | cut -d'"' -f4)
                    version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$version_dir/manifest.json" | head -1 | cut -d'"' -f4)
                    
                    echo "✅ Found: $name (v$version)"
                    echo "   Extension ID: $ext_id"
                    echo ""
                    found=1
                fi
            fi
        done
    fi
done

if [ $found -eq 0 ]; then
    echo "❌ BrainPlus extension not found"
    echo ""
    echo "Make sure:"
    echo "  1. BrainPlus extension is installed"
    echo "  2. Extension is loaded in chrome://extensions"
    echo ""
    echo "You can also find it manually:"
    echo "  1. Go to chrome://extensions"
    echo "  2. Enable Developer mode"
    echo "  3. Look for BrainPlus and copy the ID"
fi

