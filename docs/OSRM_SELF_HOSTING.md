# Complete Guide: Self-Hosting OSRM Docker with India Map Data

This guide provides the complete, step-by-step process to host your own **OSRM Docker container** pre-loaded with **India OpenStreetMap data (`india-latest.osm.pbf`)** and connect it to your TREK application.

---

## 🏗️ Architecture Overview

```
+-------------------------------------------------------------------+
|                        Your VPS / Local Server                    |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |             OSRM Docker Container (Port 5000)               |  |
|  |           `osrm-routed --algorithm mld /data/*.osrm`         |  |
|  |           (Pre-processed with India OSM Map Data)           |  |
|  +-------------------------------------------------------------+  |
|                                ^                                  |
|                                | HTTP GET /route/v1/driving/...   |
|                                v                                  |
|  +-------------------------------------------------------------+  |
|  |               TREK Backend (NestJS / Node.js)               |  |
|  |           `process.env.OSRM_ROUTING_URL=http://...`         |  |
|  |                 Endpoint: POST /api/maps/route              |  |
|  +-------------------------------------------------------------+  |
|                                ^                                  |
|                                | JSON GeoJSON Polyline + Legs     |
|                                v                                  |
|  +-------------------------------------------------------------+  |
|  |                React + Leaflet Frontend                     |  |
|  |     (Renders real turn-by-turn road paths on the map)       |  |
|  +-------------------------------------------------------------+  |
+-------------------------------------------------------------------+
```

---

## 📋 System Requirements for India Map Data

- **Storage**: ~2.5 GB total free disk space (India PBF is ~900 MB; extracted graph files add ~1.5 GB).
- **RAM**: Minimum 2 GB RAM (process peaks at ~1.8 GB during extraction).
- **Software**: Docker & Docker Compose installed.

---

## 💡 Recommended: Using India Regional Sub-Zones (Low RAM)

The full India map (`1.7 GB`) can exceed Docker RAM limits on standard PCs. Geofabrik provides optimized sub-regional zone maps that process in **20 seconds** with minimal RAM:

| Zone | File Name | Size | States Covered |
| :--- | :--- | :--- | :--- |
| **Northern Zone** | `northern-zone-latest.osm.pbf` | **212 MB** | Himachal Pradesh (Manali), Delhi, Punjab, Haryana, UP, Uttarakhand, J&K |
| **Western Zone** | `western-zone-latest.osm.pbf` | **209 MB** | Gujarat, Maharashtra (Mumbai), Goa, Rajasthan |
| **Southern Zone** | `southern-zone-latest.osm.pbf` | **531 MB** | Karnataka (Bengaluru), Kerala, Tamil Nadu, Telangana, Andhra |
| **Eastern Zone** | `eastern-zone-latest.osm.pbf` | **235 MB** | West Bengal (Kolkata), Bihar, Jharkhand, Odisha |
| **Central Zone** | `central-zone-latest.osm.pbf` | **334 MB** | Madhya Pradesh, Chhattisgarh |
| **North-Eastern Zone** | `north-eastern-zone-latest.osm.pbf` | **104 MB** | Assam, Meghalaya, Sikkim, Arunachal, Manipur, Nagaland, Tripura |

---

## 🧹 Cleaning Up & Switching Zones

Before switching to a new region, clean up the old files in `osrm-data` to save disk space:

```powershell
cd E:\odoo-ld\TREK\osrm-data
Remove-Item * -Recurse -Force
```

---

## 🚀 1-Click Zone Setup Commands

### 🟢 Western Zone (Gujarat, Mumbai / Maharashtra, Goa, Rajasthan)
```powershell
cd E:\odoo-ld\TREK\osrm-data
Remove-Item * -Recurse -Force
Invoke-WebRequest -Uri "https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf" -OutFile "western-zone-latest.osm.pbf"
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/western-zone-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/western-zone-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/western-zone-latest.osrm
cd ..
$env:OSRM_MAP_FILE="/data/western-zone-latest.osrm"
docker-compose -f docker-compose.osrm.yml up -d
```

### 🔵 Southern Zone (Bengaluru / Karnataka, Kerala, Chennai / Tamil Nadu, Hyderabad / Telangana, Andhra)
```powershell
cd E:\odoo-ld\TREK\osrm-data
Remove-Item * -Recurse -Force
Invoke-WebRequest -Uri "https://download.geofabrik.de/asia/india/southern-zone-latest.osm.pbf" -OutFile "southern-zone-latest.osm.pbf"
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/southern-zone-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/southern-zone-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/southern-zone-latest.osrm
cd ..
$env:OSRM_MAP_FILE="/data/southern-zone-latest.osrm"
docker-compose -f docker-compose.osrm.yml up -d
```

### 🟡 Eastern Zone (Kolkata / West Bengal, Bihar, Jharkhand, Odisha)
```powershell
cd E:\odoo-ld\TREK\osrm-data
Remove-Item * -Recurse -Force
Invoke-WebRequest -Uri "https://download.geofabrik.de/asia/india/eastern-zone-latest.osm.pbf" -OutFile "eastern-zone-latest.osm.pbf"
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/eastern-zone-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/eastern-zone-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/eastern-zone-latest.osrm
cd ..
$env:OSRM_MAP_FILE="/data/eastern-zone-latest.osrm"
docker-compose -f docker-compose.osrm.yml up -d
```

---

## 🚀 Full Step-by-Step Setup Process (Standard)

### Step 1: Create Directory & Download India OpenStreetMap Data

Create the `osrm-data` folder inside your project root and download the India map dataset from Geofabrik:

#### Linux / macOS:
```bash
# Create osrm-data folder
mkdir -p osrm-data
cd osrm-data

# Download India OSM PBF file (~900 MB)
wget https://download.geofabrik.de/asia/india-latest.osm.pbf
```

#### Windows (PowerShell):
```powershell
mkdir osrm-data
cd osrm-data

# Download India OSM PBF file using PowerShell
Invoke-WebRequest -Uri "https://download.geofabrik.de/asia/india-latest.osm.pbf" -OutFile "india-latest.osm.pbf"
```

---

### Step 2: Extract & Process Road Graphs (MLD Algorithm)

Run the official `osrm/osrm-backend` Docker image to extract road profiles, partition road graphs, and customize network weights:

#### Linux / macOS / Bash:
```bash
# 1. Extract road profile (limiting to 2 threads to save RAM and prevent out-of-memory crashes)
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf -t 2

# 2. Partition road network graphs
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/india-latest.osrm

# 3. Customize road weights & speeds
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/india-latest.osrm
```

#### Windows PowerShell:
```powershell
# 1. Extract road profile (limiting to 2 threads to save RAM and prevent out-of-memory crashes)
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf -t 2

# 2. Partition road network graphs
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/india-latest.osrm

# 3. Customize road weights
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/india-latest.osrm
```

> **IMPORTANT**: Step 1 (`osrm-extract`) **must finish completely** before running Step 2 (`osrm-partition`).
> If you see `[error] Input file "/data/india-latest.osrm.ebg" not found!`, it means Step 1 was skipped or interrupted. Run Step 1 (`osrm-extract`) first and wait for `[info] finished-extract` before running Step 2.


---

### Step 3: Launch OSRM Container with Docker Compose

Return to the repository root directory and start the OSRM Docker container using [`docker-compose.osrm.yml`](file:///e:/odoo-ld/TREK/docker-compose.osrm.yml):

```bash
# Navigate back to repository root
cd ..

# Start OSRM Docker container in background (-d)
docker-compose -f docker-compose.osrm.yml up -d
```

---

### Step 4: Verify OSRM Container Status & Health

Check if your OSRM container is running and healthy:

```bash
# Check container status
docker ps -f name=trek_osrm_router

# Test routing request (Surat to Manali)
curl "http://localhost:5000/route/v1/driving/72.8311,21.1702;77.1892,32.2432?overview=full&geometries=geojson"
```

If it returns a JSON response containing `"code": "Ok"` and a list of GeoJSON coordinates, your self-hosted India OSRM server is active!

---

### Step 5: Connect TREK Backend to Your OSRM Container

Open your [`server/.env`](file:///e:/odoo-ld/TREK/server/.env) file and configure your OSRM routing URL:

```env
# Self-hosted OSRM container URL
OSRM_ROUTING_URL=http://localhost:5000
```

> If TREK and OSRM run in separate Docker containers on a VPS, set:
> `OSRM_ROUTING_URL=http://osrm:5000`

---

### Step 6: Test in TREK App (React + Leaflet)

1. Start your TREK development server (`npm run dev`).
2. Open a trip in your browser (e.g. *Trip to Manali*).
3. Add 2 places in India to a day (e.g., **Delhi** `28.6139, 77.2090` and **Manali** `32.2432, 77.1892`).
4. Toggle **"Show Route"** ON.
5. The map will fetch the turn-by-turn road polyline from your backend `/api/maps/route` and render real road geometries on **Leaflet**!

---

## ⚡ Option 2: HeiGIT OpenRouteService Alternative

If you do not wish to run Docker containers or need multi-modal routing (bike/walk/car) without local storage overhead:

1. Register for a free API key at [account.heigit.org/manage/key](https://account.heigit.org/manage/key).
2. Set `ORS_API_KEY` in `server/.env`:
   ```env
   ORS_API_KEY=your_heigit_api_key_here
   ```
3. Restart TREK backend. TREK will automatically route through OpenRouteService API with full support for driving, walking, and cycling!
