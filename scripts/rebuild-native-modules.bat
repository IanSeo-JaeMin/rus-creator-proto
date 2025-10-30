@echo off
REM Rebuild native modules for Electron in the installed application
REM This script must be run from the application installation directory

echo Rebuilding native modules for Electron...
echo.

REM Check if we're in the right directory
if not exist "resources\app.asar" (
    echo ERROR: This script must be run from the application installation directory.
    echo Expected path: C:\Program Files\rus-creator\
    echo.
    pause
    exit /b 1
)

REM Extract app.asar temporarily if needed, or rebuild directly
echo Running electron-builder install-app-deps...
npx electron-builder install-app-deps

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Successfully rebuilt native modules!
    echo Please restart the application.
) else (
    echo.
    echo ERROR: Failed to rebuild native modules.
    echo Please ensure you have Node.js and build tools installed.
)

echo.
pause

