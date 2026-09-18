@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title OSRM 6-Zone India Engine + Cloudflare Tunnel

echo ================================================================
echo   TREK - 6-Zone OSRM India Engine + Multi-Zone Gateway + Tunnel
echo ================================================================
echo.

:: Check Docker Daemon
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running!
    echo Please make sure Docker Desktop is launched and ready.
    echo.
    echo Opening Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting 15 seconds for Docker to initialize...
    timeout /t 15 /nobreak >nul
)

:: Re-check Docker
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Docker is still starting up. Please wait until Docker Desktop
    echo icon in your system tray is steady, then run this script again.
    pause
    exit /b 1
)

echo [1/3] Starting 6-Zone OSRM Docker Containers (Ports 5001-5006)...
:: Recreate any containers that held port 5000 previously
docker compose -f docker-compose.osrm.yml up -d

echo.
echo [2/3] Starting Multi-Zone OSRM Gateway on Port 5000...
start "TREK OSRM Multi-Zone Gateway (Port 5000) [LIVE LOGS]" cmd /k "cd /d \"%~dp0\" && node server/scripts/osrm-gateway.js"

timeout /t 3 /nobreak >nul

echo.
echo ================================================================
echo [3/3] Starting Cloudflare Tunnel on http://127.0.0.1:5000
echo.
echo Look for the line below starting with:
echo   https://...trycloudflare.com
echo.
echo Copy that URL and paste it into Railway as:
echo   OSRM_ROUTING_URL=https://...trycloudflare.com
echo ================================================================
echo.

:: Run Cloudflare Tunnel (IPv4 127.0.0.1 with http2 to prevent Windows socket drops)
cloudflared tunnel --protocol http2 --url http://127.0.0.1:5000

pause
