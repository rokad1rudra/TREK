"""
OSRM High-Level Service
Exposes route, distance, duration, matrix, and nearest computation for the ML microservice.
"""

from typing import List, Tuple, Dict, Any, Optional
from app.osrm.client import OSRMClient, osrm_client
from app.utils.logger import get_logger

logger = get_logger("osrm-service")

class OSRMService:
    def __init__(self, client: Optional[OSRMClient] = None):
        self.client = client or osrm_client

    def route(
        self,
        coordinates: List[Tuple[float, float]],
        profile: str = "driving",
        overview: str = "full",
        geometries: str = "geojson",
        steps: bool = True,
    ) -> Dict[str, Any]:
        """Calculates road route geometry, turn steps, distance, and duration."""
        return self.client.route(
            coordinates=coordinates,
            profile=profile,
            overview=overview,
            geometries=geometries,
            steps=steps
        )

    def distance_and_duration(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        profile: str = "driving"
    ) -> Tuple[float, float]:
        """Returns (distance_km, duration_hours) in a single fast call."""
        if not origin or not destination:
            return 0.0, 0.0
        if abs(origin[0] - destination[0]) < 0.0001 and abs(origin[1] - destination[1]) < 0.0001:
            return 0.0, 0.0
        res = self.client.route([origin, destination], profile=profile, overview="simplified", steps=False)
        routes = res.get("routes", [])
        if routes:
            distance_meters = routes[0].get("distance", 0.0)
            duration_sec = routes[0].get("duration", 0.0)
            return round(distance_meters / 1000.0, 2), round(duration_sec / 3600.0, 2)
        return 0.0, 0.0

    def distance(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        profile: str = "driving"
    ) -> float:
        """Returns road distance in kilometers between two points."""
        dist, _ = self.distance_and_duration(origin, destination, profile=profile)
        return dist

    def duration(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        profile: str = "driving"
    ) -> float:
        """Returns road travel duration in hours between two points."""
        _, dur = self.distance_and_duration(origin, destination, profile=profile)
        return dur

    def matrix(
        self,
        origins: List[Tuple[float, float]],
        destinations: Optional[List[Tuple[float, float]]] = None,
        profile: str = "driving"
    ) -> Dict[str, Any]:
        """Returns distance (km) and duration (hours) matrix."""
        res = self.client.table(origins, destinations, profile=profile)
        distances_m = res.get("distances", [])
        durations_s = res.get("durations", [])

        distances_km = [
            [round(d / 1000.0, 2) if d is not None else None for d in row]
            for row in distances_m
        ]
        durations_h = [
            [round(t / 3600.0, 2) if t is not None else None for t in row]
            for row in durations_s
        ]

        return {
            "distances_km": distances_km,
            "durations_hours": durations_h,
            "raw": res
        }

    def nearest(
        self,
        coordinate: Tuple[float, float],
        profile: str = "driving"
    ) -> Dict[str, Any]:
        """Snaps coordinate to nearest road node."""
        return self.client.nearest(coordinate, profile=profile)

osrm_service = OSRMService()
