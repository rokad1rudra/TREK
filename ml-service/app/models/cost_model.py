"""
Trip Cost Prediction Model
Estimates total trip budget and itemized cost breakdown based on trip parameters.
"""

from typing import Dict, Any
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

class TripCostModel:
    def __init__(self):
        self.model: Any = None
        self._build_pipeline()

    def _build_pipeline(self):
        categorical_features = ['hotel_category', 'transport_type', 'season']
        numeric_features = ['distance_km', 'duration_hours', 'people', 'days']

        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
            ]
        )

        self.model = Pipeline([
            ('preprocessor', preprocessor),
            ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
        ])

    def predict_cost(
        self,
        distance_km: float,
        duration_hours: float,
        people: int,
        days: int,
        transport_type: str = "train",
        hotel_category: str = "budget",
        season: str = "winter"
    ) -> Dict[str, Any]:
        """
        Predicts total cost and computes granular breakdown.
        """
        # Baseline deterministic feature weighting when model is initialized
        stay_rates = {"budget": 1200.0, "comfort": 3500.0, "luxury": 8500.0}
        food_rate_per_day = 600.0
        activity_rate_per_day = 400.0

        # Transport base costs
        transport_rates_per_km = {
            "train": 1.2,
            "flight": 4.5,
            "bus": 1.0,
            "road_trip": 1.8,
            "cab": 3.0
        }

        # Room sharing estimation
        rooms = max(1, (people + 1) // 2) if hotel_category != "budget" else max(1, (people + 3) // 4)
        night_count = max(1, days - 1)
        
        stay_cost = rooms * night_count * stay_rates.get(hotel_category.lower(), 1500.0)
        transport_unit = transport_rates_per_km.get(transport_type.lower(), 1.5)
        travel_cost = max(500.0, distance_km * transport_unit * people)
        food_cost = people * days * food_rate_per_day
        activity_cost = people * days * activity_rate_per_day
        subtotal = stay_cost + travel_cost + food_cost + activity_cost
        buffer_cost = round(subtotal * 0.05, 2)
        total_estimated = round(subtotal + buffer_cost, 2)

        return {
            "estimated_total_cost": total_estimated,
            "cost_per_person": round(total_estimated / max(1, people), 2),
            "cost_per_day": round(total_estimated / (max(1, days) * max(1, people)), 2),
            "breakdown": {
                "stay": round(stay_cost, 2),
                "food": round(food_cost, 2),
                "travel": round(travel_cost, 2),
                "activities": round(activity_cost, 2),
                "buffer": buffer_cost
            }
        }

cost_model = TripCostModel()
