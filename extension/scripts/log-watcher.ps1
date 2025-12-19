# PowerShell Log Watcher for Windows
# Monitors Chrome extension logs and exports to EXTENSION_LOGS.txt

$LOG_FILE = Join-Path $PSScriptRoot "..\EXTENSION_LOGS.txt"
$CHROME_DEBUG_PORT = 9222
$POLL_INTERVAL = 2  # seconds

Write-Host "🔍 Extension Log Watcher (PowerShell)" -ForegroundColor Cyan
Write-Host "📝 Logs will be written to: $LOG_FILE" -ForegroundColor Gray
Write-Host "🔄 Polling every $POLL_INTERVAL seconds" -ForegroundColor Gray
Write-Host ""

# Check if Chrome is running with remote debugging
function Test-ChromeDebug {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$CHROME_DEBUG_PORT/json" -UseBasicParsing -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

# Get extension background page WebSocket URL
function Get-ExtensionTarget {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$CHROME_DEBUG_PORT/json" -UseBasicParsing
        $target = $response | Where-Object { 
            $_.type -eq "service_worker" -or 
            ($_.url -like "chrome-extension://*" -and $_.type -eq "background_page")
        } | Select-Object -First 1
        
        return $target
    } catch {
        return $null
    }
}

# Fetch logs using Chrome DevTools Protocol
function Get-ExtensionLogs {
    param($extensionId)
    
    try {
        # For simplicity, we'll instruct the user to open the logs viewer page
        # which is more reliable than WebSocket from PowerShell
        return $null
    } catch {
        Write-Host "⚠️ Error fetching logs: $_" -ForegroundColor Yellow
        return $null
    }
}

# Write initial instructions
$instructions = @"
# Extension Debug Logs
# 
# SETUP REQUIRED:
# 
# METHOD 1: Automated Log Export (Recommended)
# ============================================
# 1. Start Chrome/Brave with remote debugging:
#    
#    For Chrome:
#    chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug"
#    
#    For Brave:
#    brave.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\brave-debug"
#
# 2. Load your extension
# 
# 3. Run the Node.js watcher:
#    cd extension
#    npm run watch-logs
#
#
# METHOD 2: Manual Export (Simpler)
# ===================================
# 1. Load your extension in Chrome/Brave
# 2. Open the log viewer: chrome-extension://YOUR_ID/logs.html
# 3. Click "Export to File" button
# 4. Save the file as EXTENSION_LOGS.txt in the extension folder
# 5. Cursor can now read the logs!
#
#
# METHOD 3: Use the Logs Viewer Page
# ====================================
# 1. Right-click the extension icon > Manage Extension
# 2. Copy the Extension ID
# 3. Open: chrome-extension://YOUR_EXTENSION_ID/logs.html
# 4. The page auto-refreshes every 3 seconds
# 5. Use "Export to File" or "Copy All" buttons
#
# Waiting for logs...

"@

Set-Content -Path $LOG_FILE -Value $instructions

Write-Host ""
Write-Host "⚠️  IMPORTANT SETUP STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "The PowerShell watcher has limitations. Use one of these methods:" -ForegroundColor White
Write-Host ""
Write-Host "METHOD 1 (Best): Use Node.js watcher" -ForegroundColor Green
Write-Host "  cd extension" -ForegroundColor Gray
Write-Host "  npm install ws" -ForegroundColor Gray
Write-Host "  npm run watch-logs" -ForegroundColor Gray
Write-Host ""
Write-Host "METHOD 2 (Easiest): Open the logs viewer page" -ForegroundColor Green
Write-Host "  1. Get your extension ID from chrome://extensions" -ForegroundColor Gray
Write-Host "  2. Open: chrome-extension://YOUR_ID/logs.html" -ForegroundColor Gray
Write-Host "  3. Click 'Export to File' and save as EXTENSION_LOGS.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "METHOD 3: Copy from browser console" -ForegroundColor Green
Write-Host "  The logger writes to both console AND storage" -ForegroundColor Gray
Write-Host "  Press F12 in your extension, and logs will appear there too" -ForegroundColor Gray
Write-Host ""

# Monitor Chrome status
$lastStatus = $false
while ($true) {
    $isRunning = Test-ChromeDebug
    
    if ($isRunning -ne $lastStatus) {
        if ($isRunning) {
            Write-Host "✅ Chrome detected with remote debugging" -ForegroundColor Green
            $target = Get-ExtensionTarget
            if ($target) {
                Write-Host "✅ Extension found: $($target.title)" -ForegroundColor Green
                Write-Host ""
                Write-Host "📖 To export logs automatically, use the Node.js watcher instead:" -ForegroundColor Cyan
                Write-Host "   npm run watch-logs" -ForegroundColor Gray
            } else {
                Write-Host "⚠️  Extension not found. Make sure it's loaded." -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Chrome not running with remote debugging" -ForegroundColor Red
            Write-Host "   Start with: chrome.exe --remote-debugging-port=9222" -ForegroundColor Gray
        }
        $lastStatus = $isRunning
    }
    
    Start-Sleep -Seconds $POLL_INTERVAL
}

