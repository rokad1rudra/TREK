@echo off
setlocal enabledelayedexpansion
title OSRM India Engine + Cloudflare Tunnel

echo ================================================================
echo   TREK - OSRM India Engine + Cloudflare Tunnel
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

echo [1/3] Starting West Zone OSRM Docker Container (Ports 5000 / 5002)...
docker compose -f docker-compose.osrm.west.yml up -d

echo.
echo [2/3] Checking OSRM container health...
timeout /t 3 /nobreak >nul
docker ps --filter "name=trek_osrm_west"

echo.
echo ================================================================
echo [3/3] Starting Cloudflare Tunnel on http://localhost:5000
echo.
echo Look for the line below starting with:
echo   https://...trycloudflare.com
echo.
echo Copy that URL and paste it into Railway as:
echo   OSRM_ROUTING_URL=https://...trycloudflare.com
echo ================================================================
echo.

:: Run Cloudflare Tunnel
cloudflared tunnel --url http://localhost:5000

pause
