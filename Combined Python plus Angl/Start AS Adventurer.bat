@echo off
title Don's Adventurer
echo.
echo ================================================================
echo   Don's Adventurer  —  Overlay + Creator + Live2D + Music
echo ================================================================
echo   Made by TheDonOfEverything aka Paul Conforti
echo   Original JavaScript by Leaflit
echo   Angular improvements by OOzeClues (v0.3.0)
echo   Python Combined Edition 2026
echo ================================================================
echo.
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found in PATH.
    echo Install Python 3.10+ from https://python.org
    echo Make sure "Add Python to PATH" is checked.
    pause
    exit /b 1
)

echo Checking dependencies...
python -c "import flask, websockets, numpy, requests" 2>nul
if %ERRORLEVEL% neq 0 (
    echo Installing required packages...
    python -m pip install -r requirements.txt
    if %ERRORLEVEL% neq 0 (
        python -m pip install flask websockets numpy requests
    )
)

echo.
echo Starting Don's Adventurer on http://localhost:3000
echo Press Ctrl+C in this window to stop the server.
echo.
python server.py
pause
