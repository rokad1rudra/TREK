@echo off
echo ========================================================
echo Starting West Zone OSRM Docker Container (Port 5000 / 5002)
echo Gujarat, Maharashtra, Goa, Rajasthan
echo ========================================================
docker compose -f docker-compose.osrm.west.yml up -d
echo.
echo Check status: docker logs --tail 20 trek_osrm_west
pause
