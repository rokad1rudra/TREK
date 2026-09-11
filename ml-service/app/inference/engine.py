"""
Inference Engine
Loads serialized Joblib models into memory on startup and executes predictions.
"""

from typing import Dict, Any, Optional
from pathlib import Path
import joblib
import pandas as pd
from app.utils.config import settings
from app.utils.logger import get_logger
from app.training.pipeline import train_and_save_cost_model
from app.preprocessing.feature_engineering import extract_trip_features

logger = get_logger("inference-engine")

class InferenceEngine:
    def __init__(self):
        self.cost_model: Optional[Any] = None
        self._load_models()

    def _load_models(self):
        cost_model_path = settings.TRAINED_MODELS_DIR / "cost_model.joblib"
        if not cost_model_path.exists():
            logger.info("No serialized model found. Bootstrapping baseline model...")
            try:
                cost_model_path = train_and_save_cost_model()
            except Exception as e:
                logger.error(f"Error bootstrapping model: {e}")

        if cost_model_path.exists():
            try:
                self.cost_model = joblib.load(cost_model_path)
                logger.info(f"Loaded ML model from {cost_model_path}")
            except Exception as e:
                logger.warning(f"Failed to load serialized model ({e}). Fallback logic active.")
                self.cost_model = None

    def predict_cost(self, trip_input: Dict[str, Any]) -> Dict[str, Any]:
        """Predicts cost using loaded ML model pipeline or fallback formula."""
        features_df = extract_trip_features(trip_input)
        distance_km = float(trip_input.get("distance_km", 400.0))
        people = int(trip_input.get("people", 2))
        days = int(trip_input.get("days", 4))
        hotel_category = str(trip_input.get("hotel_category", "budget")).lower()
        transport_type = str(trip_input.get("transport_type", "train")).lower()

        if self.cost_model is not None:
            try:
                predicted_total = float(self.cost_model.predict(features_df)[0])
                predicted_total = round(max(500.0, predicted_total), 2)
            except Exception as e:
                logger.warning(f"Inference error: {e}, using formula.")
                predicted_total = self._calculate_fallback_cost(distance_km, people, days, hotel_category, transport_type)
        else:
            predicted_total = self._calculate_fallback_cost(distance_km, people, days, hotel_category, transport_type)

        # Compute breakdown
        stay_ratio = 0.38 if hotel_category == "luxury" else 0.34
        travel_ratio = 0.30 if transport_type == "flight" else 0.22
        food_ratio = 0.24
        act_ratio = 0.12
        buffer_ratio = 0.04

        stay_cost = round(predicted_total * stay_ratio, 2)
        travel_cost = round(predicted_total * travel_ratio, 2)
        food_cost = round(predicted_total * food_ratio, 2)
        act_cost = round(predicted_total * act_ratio, 2)
        buffer_cost = round(predicted_total * buffer_ratio, 2)

        return {
            "estimated_total_cost": predicted_total,
            "cost_per_person": round(predicted_total / max(1, people), 2),
            "cost_per_day": round(predicted_total / (max(1, days) * max(1, people)), 2),
            "breakdown": {
                "stay": stay_cost,
                "food": food_cost,
                "travel": travel_cost,
                "activities": act_cost,
                "buffer": buffer_cost
            }
        }

    def _calculate_fallback_cost(self, distance_km: float, people: int, days: int, hotel: str, transport: str) -> float:
        rates = {"budget": 1200.0, "comfort": 3200.0, "luxury": 7500.0}
        t_rates = {"train": 1.1, "flight": 4.2, "bus": 0.95, "road_trip": 1.7}
        stay = (days - 1) * rates.get(hotel, 1500.0) * max(1, (people + 1) // 2)
        trans = distance_km * t_rates.get(transport, 1.2) * people
        food = people * days * 600.0
        act = people * days * 350.0
        return round(max(1000.0, stay + trans + food + act), 2)

inference_engine = InferenceEngine()
