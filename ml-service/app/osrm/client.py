"""
OSRM (Open Source Routing Machine) HTTP Client
Interacts with the user's self-hosted OSRM container/server.
"""

from typing import List, Tuple, Dict, Any, Optional
import math
import requests
from app.utils.config import settings
from app.utils.logger import get_logger

logger = get_logger("osrm-client")

class OSRMClient:
    def __init__(self, base_url: Optional[str] = None, timeout: float = 0.8):
        self.base_url = (base_url or settings.OSRM_URL).rstrip("/")
        self.connect_timeout = 0.25
        self.read_timeout = 0.8
        self._public_endpoints = [
            "https://router.project-osrm.org",
            "https://routing.openstreetmap.de/routed-car",
        ]
        self._route_cache: Dict[str, Dict[str, Any]] = {}

    def _get_candidate_local_ports(self, coordinates: List[Tuple[float, float]]) -> List[int]:
        """Picks the most relevant local zonal container port based on geographic coordinates."""
        if not coordinates:
            return [5002, 5000, 5001, 5005, 5003, 5004]
        avg_lon = sum(c[0] for c in coordinates) / len(coordinates)
        avg_lat = sum(c[1] for c in coordinates) / len(coordinates)

        if avg_lon < 75.0 and 17.0 <= avg_lat <= 24.8:
            return [5002, 5000, 5001, 5004, 5003, 5005]  # West first
        elif avg_lat >= 25.0 and 72.0 <= avg_lon <= 80.5:
            return [5000, 5002, 5004, 5001, 5003, 5005]  # North first
        elif avg_lat < 17.5:
            return [5001, 5002, 5000, 5004, 5003, 5005]  # South first
        elif avg_lon >= 88.0:
            return [5005, 5003, 5000, 5002, 5001, 5004]  # East/NE first
        elif 75.0 <= avg_lon <= 84.0 and 21.0 <= avg_lat <= 26.5:
            return [5004, 5000, 5002, 5001, 5003, 5005]  # Central first

        return [5002, 5000, 5001, 5005, 5003, 5004]

    def _query_osrm_endpoint(self, base_url: str, profile: str, coords_str: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        clean_base = base_url.rstrip("/")
        url = f"{clean_base}/route/v1/{profile}/{coords_str}"
        try:
            resp = requests.get(url, params=params, timeout=(self.connect_timeout, self.read_timeout))
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    # Verify that waypoints snapped to legitimate local roads (< 25 km snap)
                    waypoints = data.get("waypoints", [])
                    if waypoints and any(w.get("distance", 0) > 25000 for w in waypoints):
                        return None
                    return data
        except Exception:
            pass
        return None

    def route(
        self,
        coordinates: List[Tuple[float, float]],
        profile: str = "driving",
        overview: str = "full",
        geometries: str = "geojson",
        steps: bool = True,
        alternatives: bool = False,
    ) -> Dict[str, Any]:
        """
        Request turn-by-turn road route between coordinates.
        1. Fast in-memory LRU cache
        2. Best matched local zonal container
        3. Cross-zone public OSRM router
        4. Immediate geodesic calculation fallback
        """
        if len(coordinates) < 2:
            raise ValueError("At least two coordinate pairs are required for routing.")

        coords_str = ";".join([f"{lon:.6f},{lat:.6f}" for lon, lat in coordinates])
        cache_key = f"{profile}:{coords_str}:{overview}:{steps}"
        if cache_key in self._route_cache:
            return self._route_cache[cache_key]

        params = {
            "overview": overview,
            "geometries": geometries,
            "steps": "true" if steps else "false",
            "alternatives": "true" if alternatives else "false",
        }

        # 1. Check zonal local self-hosted containers (prioritizing geographic match)
        candidate_ports = self._get_candidate_local_ports(coordinates)
        for port in candidate_ports:
            endpoint = f"http://localhost:{port}"
            data = self._query_osrm_endpoint(endpoint, profile, coords_str, params)
            if data:
                self._route_cache[cache_key] = data
                return data

        # 2. For cross-zone routing, query public OSRM endpoints
        for pub_url in self._public_endpoints:
            data = self._query_osrm_endpoint(pub_url, profile, coords_str, params)
            if data:
                self._route_cache[cache_key] = data
                return data

        # 3. Final Geodesic fallback
        fallback = self._geodesic_fallback_route(coordinates)
        self._route_cache[cache_key] = fallback
        return fallback

    def table(
        self,
        origins: List[Tuple[float, float]],
        destinations: Optional[List[Tuple[float, float]]] = None,
        profile: str = "driving",
    ) -> Dict[str, Any]:
        """
        Calculates travel time and distance matrix.
        """
        all_coords = list(origins)
        dest_indices = None

        if destinations:
            all_coords.extend(destinations)
            src_indices = ";".join(str(i) for i in range(len(origins)))
            dst_indices = ";".join(str(i) for i in range(len(origins), len(all_coords)))
        else:
            src_indices = ";".join(str(i) for i in range(len(origins)))
            dst_indices = src_indices

        coords_str = ";".join([f"{lon:.6f},{lat:.6f}" for lon, lat in all_coords])
        url = f"{self.base_url}/table/v1/{profile}/{coords_str}"
        params = {
            "sources": src_indices,
            "destinations": dst_indices,
            "annotations": "duration,distance",
        }

        try:
            resp = requests.get(url, params=params, timeout=self.timeout)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok":
                    return data
        except Exception as e:
            logger.warning(f"OSRM table query failed ({e}). Generating geodesic matrix.")

        # Fallback matrix
        return self._geodesic_fallback_table(origins, destinations or origins)

    def nearest(self, coordinate: Tuple[float, float], profile: str = "driving", number: int = 1) -> Dict[str, Any]:
        """
        Snaps a coordinate to the nearest road network node.
        """
        lon, lat = coordinate
        url = f"{self.base_url}/nearest/v1/{profile}/{lon:.6f},{lat:.6f}"
        params = {"number": number}

        try:
            resp = requests.get(url, params=params, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.warning(f"OSRM nearest query failed ({e}).")

        return {
            "code": "Ok",
            "waypoints": [{"location": [lon, lat], "distance": 0.0, "name": "Snapped Road Fallback"}]
        }

    def _haversine_distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        # Multiply by 1.25 road winding factor
        return R * c * 1.25

    def _geodesic_fallback_route(self, coordinates: List[Tuple[float, float]]) -> Dict[str, Any]:
        total_dist_m = 0.0
        for i in range(len(coordinates) - 1):
            lon1, lat1 = coordinates[i]
            lon2, lat2 = coordinates[i + 1]
            dist_km = self._haversine_distance_km(lat1, lon1, lat2, lon2)
            total_dist_m += dist_km * 1000.0

        duration_sec = (total_dist_m / 1000.0) / 55.0 * 3600.0  # ~55 km/h avg speed

        return {
            "code": "Ok",
            "routes": [
                {
                    "distance": round(total_dist_m, 1),
                    "duration": round(duration_sec, 1),
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[lon, lat] for lon, lat in coordinates]
                    },
                    "legs": [
                        {
                            "distance": round(total_dist_m, 1),
                            "duration": round(duration_sec, 1),
                            "summary": "Geodesic Road Path",
                            "steps": []
                        }
                    ]
                }
            ],
            "waypoints": [
                {"location": [lon, lat], "name": f"Waypoint {i+1}"}
                for i, (lon, lat) in enumerate(coordinates)
            ]
        }

    def _geodesic_fallback_table(
        self,
        origins: List[Tuple[float, float]],
        destinations: List[Tuple[float, float]]
    ) -> Dict[str, Any]:
        distances = []
        durations = []

        for lon1, lat1 in origins:
            row_dist = []
            row_dur = []
            for lon2, lat2 in destinations:
                d_km = self._haversine_distance_km(lat1, lon1, lat2, lon2)
                d_m = d_km * 1000.0
                dur_s = (d_km / 55.0) * 3600.0
                row_dist.append(round(d_m, 1))
                row_dur.append(round(dur_s, 1))
            distances.append(row_dist)
            durations.append(row_dur)

        return {
            "code": "Ok",
            "distances": distances,
            "durations": durations,
        }

osrm_client = OSRMClient()
