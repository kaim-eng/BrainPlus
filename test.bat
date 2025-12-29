@echo off
REM BrainPlus Sync - Quick Test Setup Script (Windows)

echo ============================================================
echo BrainPlus Cross-Device Sync - Quick Test Setup
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js 16+ first.
    echo Download from: https://nodejs.org/
    exit /b 1
)

node --version
echo.

REM Step 1: Install signaling server dependencies
echo Step 1: Installing signaling server dependencies...
cd signaling-server
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install signaling server dependencies
        exit /b 1
    )
)
echo OK: Signaling server dependencies installed
echo.

REM Step 2: Install extension dependencies
echo Step 2: Installing extension dependencies...
cd ..\extension
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install extension dependencies
        exit /b 1
    )
)
echo OK: Extension dependencies installed
echo.

REM Step 3: Build extension
echo Step 3: Building extension...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to build extension
    exit /b 1
)
echo OK: Extension built successfully
echo.

REM Step 4: Install native host dependencies
echo Step 4: Installing native host dependencies...
cd ..\native-host
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install native host dependencies
        exit /b 1
    )
)
echo OK: Native host dependencies installed
echo.

cd ..

echo ============================================================
echo OK: Setup Complete!
echo ============================================================
echo.
echo Next steps:
echo.
echo 1. Start the signaling server:
echo    cd signaling-server
echo    npm start
echo.
echo 2. Load the extension in Chrome:
echo    - Go to chrome://extensions
echo    - Enable 'Developer mode'
echo    - Click 'Load unpacked'
echo    - Select: %CD%\extension\dist
echo.
echo 3. Install native host (copy Extension ID first):
echo    cd native-host
echo    node install-manifest.js YOUR_EXTENSION_ID
echo.
echo 4. Follow the testing guide:
echo    See TESTING_GUIDE.md for detailed instructions
echo.
echo ============================================================
echo Happy Testing!
echo ============================================================

pause

