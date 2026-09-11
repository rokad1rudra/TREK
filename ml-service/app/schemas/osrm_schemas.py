from typing import List, Tuple, Optional, Any, Dict
from pydantic import BaseModel, Field

class OSRMRouteRequest(BaseModel):
    coordinates: List[Tuple[float, float]] = Field(
        ...,
        description="List of [longitude, latitude] coordinates",
        example=[[72.8311, 21.1702], [77.1892, 32.2432]]
    )
    profile: str = Field(default="driving", description="car / driving / walking")
    overview: str = Field(default="full", description="simplified / full / false")
    steps: bool = Field(default=True, description="Include turn-by-turn steps")

class OSRMMatrixRequest(BaseModel):
    origins: List[Tuple[float, float]] = Field(..., description="List of [lon, lat] origins")
    destinations: Optional[List[Tuple[float, float]]] = Field(default=None, description="List of [lon, lat] destinations")
    profile: str = Field(default="driving")

class OSRMRouteResponse(BaseModel):
    distance_km: float
    duration_hours: float
    summary: str
    geometry: Optional[Dict[str, Any]] = None
    waypoints: List[Dict[str, Any]] = []
    legs: List[Dict[str, Any]] = []
