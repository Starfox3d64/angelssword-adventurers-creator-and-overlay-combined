@echo off
echo.
echo ================================================================
echo   AS Adventurer - Combined Edition (Overlay + Creator)
echo ================================================================
echo   Made by TheDonOfEverything aka Paul Conforti
echo   Original JavaScript version by Leaflit
echo   Angular improvements by OOzeClues (v0.3.0)
echo   Python Port 2026
echo ================================================================
echo.
cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found in PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo Checking dependencies...
python -c "import flask, websockets, numpy, requests" 2>nul
if %ERRORLEVEL% neq 0 (
    echo Installing required packages...
    pip install flask websockets numpy requests
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo.
echo Starting AS Adventurer Combined...
echo Your browser will open to the main menu.
echo.
python server.py
pause
