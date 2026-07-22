@echo off
title Don's Adventurer
echo.
echo ================================================================
echo   Don's Adventurer  —  Combined Python Edition
echo ================================================================
echo   Overlay + Creator + Live2D + Music + AnimeGen + Tetris
echo.
echo   Made by TheDonOfEverything aka Paul Conforti
echo   Original JavaScript by Leaflit
echo   Angular Edition by OOzeClues  (v0.3.0 → v0.4.0 features)
echo   Python Combined Edition  v2.5.1  ·  2026
echo.
echo   0.4.0 parity: GPU/RGBA WebM export · WebGPU detect
echo                 ffmpeg ensure · music speed + export
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
