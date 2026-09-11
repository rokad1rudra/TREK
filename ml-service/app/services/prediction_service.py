"""
Prediction & Itinerary Planning Service
Coordinates OSRM routing + ML Cost Prediction + Recommendation Engine + Schedule Synthesis.
"""

from typing import Dict, Any, Tuple
from app.services.osrm_service import osrm_service
from app.inference.engine import inference_engine
from app.recommendations.ranker import recommendation_engine
from app.models.itinerary_model import itinerary_engine
from app.preprocessing.feature_engineering import resolve_city_coordinates
from app.database.mongo import save_prediction_log
from app.utils.logger import get_logger

logger = get_logger("prediction-service")

class TripPredictionService:
    def generate_plan(self, req_data: Dict[str, Any]) -> Dict[str, Any]:
        origin = req_data.get("origin", "Ahmedabad")
        destination = req_data.get("destination", "Jaipur")
        people = max(1, int(req_data.get("people", 2)))
        days = max(1, min(60, int(req_data.get("days", 4))))
        budget = float(req_data.get("budget", 20000.0))
        travel_pace = str(req_data.get("travel_pace", "balanced"))
        interests = str(req_data.get("interests", "Sightseeing, Local Cuisine, Culture, Photography"))
        transit_mode = str(req_data.get("transit_mode", "train_bus"))
        budget_tier = str(req_data.get("budget_tier", "budget"))
        season = str(req_data.get("season", "winter"))

        # 1. Resolve Coordinates
        orig_info = resolve_city_coordinates(origin)
        dest_info = resolve_city_coordinates(destination)

        orig_coords = req_data.get("origin_coords") or (orig_info["lng"], orig_info["lat"])
        dest_coords = req_data.get("dest_coords") or (dest_info["lng"], dest_info["lat"])

        # 2. OSRM Road Distance & Duration
        road_distance_km = osrm_service.distance(orig_coords, dest_coords)
        driving_hours = osrm_service.duration(orig_coords, dest_coords)

        if road_distance_km <= 0.0:
            road_distance_km = 450.0
            driving_hours = 8.0

        # 3. Predict Trip Cost using ML Model
        cost_input = {
            "origin": origin,
            "destination": destination,
            "distance_km": road_distance_km,
            "duration_hours": driving_hours,
            "people": people,
            "days": days,
            "transport_type": transit_mode.split("_")[0],
            "hotel_category": budget_tier,
            "season": season
        }
        cost_pred = inference_engine.predict_cost(cost_input)
        est_total_cost = cost_pred["estimated_total_cost"]

        # 4. Rank Candidates (Transports, Hotels, Activities)
        ranks = recommendation_engine.rank_all(
            distance_km=road_distance_km,
            duration_hours=driving_hours,
            budget=budget,
            people=people,
            days=days,
            destination_name=destination,
            user_interests=interests,
            travel_pace=travel_pace,
            budget_tier=budget_tier
        )

        # 5. Synthesize Day-by-Day Schedule
        daily_cost = round(est_total_cost / max(1, days), 2)
        itinerary_days = itinerary_engine.synthesize_schedule(
            origin=origin,
            destination=destination,
            days=days,
            distance_km=road_distance_km,
            daily_cost=daily_cost,
            ranked_activities=ranks["activities"],
            ranked_hotels=ranks["hotels"],
            travel_pace=travel_pace,
            origin_coords=orig_coords,
            dest_coords=dest_coords
        )

        response = {
            "trip_title": f"{days}-Day {origin.split(',')[0]} to {destination.split(',')[0]} Tour",
            "origin": origin,
            "destination": destination,
            "zone": dest_info.get("zone", "Regional Zone"),
            "people": people,
            "days_count": days,
            "total_distance_km": road_distance_km,
            "driving_hours": driving_hours,
            "recommended_mode": ranks["transports"][0]["title"] if ranks["transports"] else "Train / Bus",
            "estimated_total_cost": est_total_cost,
            "cost_per_person": cost_pred["cost_per_person"],
            "cost_breakdown": cost_pred["breakdown"],
            "ranked_transports": ranks["transports"],
            "recommended_hotels": ranks["hotels"],
            "recommended_activities": ranks["activities"],
            "itinerary_days": itinerary_days,
            "highlights": [
                f"Predicted Budget: ₹{est_total_cost:,.2f} for {people} Travelers",
                f"Road Distance: ~{road_distance_km} km ({driving_hours} hrs)",
                f"Top Transport: {ranks['transports'][0]['title'] if ranks['transports'] else 'Train'}",
                f"Top Stay: {ranks['hotels'][0]['name'] if ranks['hotels'] else 'Central Hotel'}"
            ],
            "model_version": "1.0.0-ml-scikit"
        }

        # Background log to MongoDB if configured
        save_prediction_log({
            "request": req_data,
            "cost_prediction": cost_pred,
            "total_distance_km": road_distance_km
        })

        return response

prediction_service = TripPredictionService()
