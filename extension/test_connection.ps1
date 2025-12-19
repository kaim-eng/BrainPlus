# Test connection to backend from Windows
# Run this from PowerShell

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP
)

Write-Host "Testing DataPay Backend Connection" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$BaseURL = "http://${ServerIP}:8000"

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseURL/health" -Method Get
    Write-Host "Success - Health Check: " -ForegroundColor Green -NoNewline
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "Failed - Health Check: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: Root Endpoint
Write-Host "2. Testing Root Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseURL/" -Method Get
    Write-Host "Success - Root Endpoint: " -ForegroundColor Green -NoNewline
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "Failed - Root: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: API Docs
Write-Host "3. Testing API Documentation..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseURL/docs" -Method Get -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "Success - API Docs available at: $BaseURL/docs" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed - API Docs not accessible" -ForegroundColor Red
}

Write-Host ""

# Test 4: Network Info
Write-Host "4. Network Information..." -ForegroundColor Yellow
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | Select-Object -First 1).IPAddress
Write-Host "   Your Windows IP: $localIP" -ForegroundColor White
Write-Host "   Target Server: $ServerIP" -ForegroundColor Cyan
Write-Host "   Port: 8000" -ForegroundColor Cyan

Write-Host ""

# Test 5: Ping
Write-Host "5. Testing Network Connectivity..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName $ServerIP -Count 2 -Quiet
if ($ping) {
    Write-Host "Success - Server is reachable via ping" -ForegroundColor Green
} else {
    Write-Host "Failed - Cannot reach server (ping failed)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "   API URL for extension: $BaseURL" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Update extension .env with: VITE_API_URL=$BaseURL" -ForegroundColor White
Write-Host "   2. Rebuild extension: npm run build" -ForegroundColor White
Write-Host "   3. Reload extension in Brave" -ForegroundColor White
Write-Host ""
