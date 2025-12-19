# Windows Setup Script for DataPay Extension
# Run this from PowerShell in the extension directory

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP
)

Write-Host "DataPay Extension - Windows Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "1. Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Success - Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "Error - Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if npm is installed
Write-Host "2. Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "Success - npm $npmVersion found" -ForegroundColor Green
} catch {
    Write-Host "Error - npm not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create .env file
Write-Host "3. Creating .env file..." -ForegroundColor Yellow
$envContent = @"
# Extension Environment Variables
VITE_API_URL=http://${ServerIP}:8000
VITE_ENVIRONMENT=development
VITE_DEBUG=true
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "Success - .env file created" -ForegroundColor Green
Write-Host "   API URL: http://${ServerIP}:8000" -ForegroundColor Cyan

Write-Host ""

# Install dependencies
Write-Host "4. Installing dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   node_modules exists, skipping..." -ForegroundColor Gray
} else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success - Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "Error - npm install failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Build extension
Write-Host "5. Building extension..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success - Extension built successfully" -ForegroundColor Green
} else {
    Write-Host "Error - Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open Brave Browser" -ForegroundColor White
Write-Host "2. Go to: brave://extensions" -ForegroundColor White
Write-Host "3. Enable Developer mode (top-right toggle)" -ForegroundColor White
Write-Host "4. Click Load unpacked" -ForegroundColor White
Write-Host "5. Select folder: $(Get-Location)\dist" -ForegroundColor White
Write-Host ""
Write-Host "Extension Path: $(Get-Location)\dist" -ForegroundColor Cyan
Write-Host "API URL: http://${ServerIP}:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test the connection:" -ForegroundColor Yellow
Write-Host "   .\test_connection.ps1 -ServerIP $ServerIP" -ForegroundColor White
Write-Host ""
