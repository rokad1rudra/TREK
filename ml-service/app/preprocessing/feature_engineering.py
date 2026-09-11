"""
Preprocessing & Feature Engineering Module
Prepares tabular features, categorical encodings, and coordinate normalization for ML pipelines.
"""

from typing import Dict, Any, List
import numpy as np
import pandas as pd

from app.preprocessing.india_places_db import INDIA_TOWNS_DB, resolve_city_coordinates

CITY_COORDINATES = INDIA_TOWNS_DB

def extract_trip_features(data: Dict[str, Any]) -> pd.DataFrame:
    """Transforms raw dictionary inputs into DataFrame ready for Scikit-learn pipelines."""
    row = {
        "distance_km": float(data.get("distance_km", 400.0)),
        "duration_hours": float(data.get("duration_hours", 7.0)),
        "people": int(data.get("people", 2)),
        "days": int(data.get("days", 4)),
        "transport_type": str(data.get("transport_type", "train")).lower(),
        "hotel_category": str(data.get("hotel_category", "budget")).lower(),
        "season": str(data.get("season", "winter")).lower(),
    }
    return pd.DataFrame([row])
