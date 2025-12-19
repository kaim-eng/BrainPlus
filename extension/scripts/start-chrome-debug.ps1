# Start Chrome with Remote Debugging for Log Watching
# This makes it easy to use the auto-export log watcher

param(
    [string]$Browser = "chrome",  # Options: chrome, brave, edge
    [int]$Port = 9222
)

Write-Host "🚀 Starting $Browser with Remote Debugging..." -ForegroundColor Cyan
Write-Host ""

$userDataDir = "$env:TEMP\$Browser-debug-$(Get-Date -Format 'yyyyMMdd')"

# Browser executable paths
$browsers = @{
    "chrome" = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
    )
    "brave" = @(
        "${env:ProgramFiles}\BraveSoftware\Brave-Browser\Application\brave.exe",
        "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe",
        "${env:LOCALAPPDATA}\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
    "edge" = @(
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
}

# Find browser executable
$browserExe = $null
foreach ($path in $browsers[$Browser]) {
    if (Test-Path $path) {
        $browserExe = $path
        break
    }
}

if (-not $browserExe) {
    Write-Host "❌ $Browser not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install $Browser or specify a different browser:" -ForegroundColor Yellow
    Write-Host "  .\start-chrome-debug.ps1 -Browser chrome" -ForegroundColor Gray
    Write-Host "  .\start-chrome-debug.ps1 -Browser brave" -ForegroundColor Gray
    Write-Host "  .\start-chrome-debug.ps1 -Browser edge" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Found: $browserExe" -ForegroundColor Green
Write-Host "📁 User data dir: $userDataDir" -ForegroundColor Gray
Write-Host "🔌 Debug port: $Port" -ForegroundColor Gray
Write-Host ""

# Check if port is in use
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "⚠️  Port $Port is already in use!" -ForegroundColor Yellow
    Write-Host "   A debug instance might already be running." -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 0
    }
}

# Start browser
Write-Host "🌐 Launching $Browser..." -ForegroundColor Cyan
Write-Host ""

$arguments = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=`"$userDataDir`"",
    "--disable-extensions-except=`"$PSScriptRoot\..\dist`"",
    "--load-extension=`"$PSScriptRoot\..\dist`""
)

try {
    Start-Process -FilePath $browserExe -ArgumentList $arguments
    
    Write-Host "✅ $Browser started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Load your extension in $Browser" -ForegroundColor White
    Write-Host "   2. In a new terminal, run: npm run watch-logs" -ForegroundColor White
    Write-Host "   3. Logs will auto-export to EXTENSION_LOGS.txt" -ForegroundColor White
    Write-Host ""
    Write-Host "🔍 Debug info:" -ForegroundColor Gray
    Write-Host "   - Debug port: http://localhost:$Port" -ForegroundColor Gray
    Write-Host "   - View targets: http://localhost:$Port/json" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "❌ Failed to start $Browser!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

