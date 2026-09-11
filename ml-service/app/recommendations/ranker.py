"""
Recommendation & Ranking Engine
Coordinates candidate generation and multi-factor ranking.
"""

from typing import List, Dict, Any
from app.models.transport_model import transport_model
from app.models.hotel_model import hotel_model
from app.models.activity_model import activity_model

class RecommendationEngine:
    def rank_all(
        self,
        distance_km: float,
        duration_hours: float,
        budget: float,
        people: int,
        days: int,
        destination_name: str,
        user_interests: str = "",
        travel_pace: str = "balanced",
        budget_tier: str = "budget"
    ) -> Dict[str, Any]:
        dest_clean = destination_name.split(",")[0].strip()

        # 1. Candidate Transports
        transport_candidates = [
            {
                "id": "train_bus",
                "type": "train",
                "title": "🚆 Superfast Train + Local Transit",
                "price_per_person": max(400.0, round(distance_km * 1.1, 2)),
                "duration_hours": round(max(3.0, distance_km / 65.0), 1),
                "comfort_rating": 4.2,
                "availability_score": 0.95,
                "description": f"Affordable and scenic rail transit to {dest_clean} with confirmed sleeper / 3AC berths."
            },
            {
                "id": "flight_cab",
                "type": "flight",
                "title": "✈️ Flight + Direct Cab Transfer",
                "price_per_person": max(2500.0, round(distance_km * 4.2, 2)),
                "duration_hours": round(max(1.5, distance_km / 350.0 + 2.0), 1),
                "comfort_rating": 4.8,
                "availability_score": 0.85,
                "description": f"Fastest travel mode to {dest_clean} via domestic flight link and express cab."
            },
            {
                "id": "road_trip",
                "type": "road_trip",
                "title": "🚗 Scenic Road Drive / Private SUV",
                "price_per_person": max(600.0, round((distance_km * 8.5) / max(1, people), 2)),
                "duration_hours": round(max(2.0, duration_hours), 1),
                "comfort_rating": 4.3,
                "availability_score": 0.99,
                "description": f"Self-drive or private cab along national highway corridors with stopovers."
            }
        ]
        ranked_transports = transport_model.rank_options(
            transport_candidates,
            user_budget_per_person=budget / max(1, people),
            distance_km=distance_km,
            people=people
        )

        # 2. Candidate Hotels
        user_daily_budget = budget / max(1, days * people)
        hotel_candidates = [
            {
                "id": f"{dest_clean.lower()}-value-stay",
                "name": f"{dest_clean} Heritage Zostel / Value Residency",
                "tier": "budget",
                "price_per_night": 1200.0,
                "rating": 4.3,
                "review_count": 340,
                "amenities": ["Free Wi-Fi", "Clean Bedding", "Hot Water", "Common Cafe"],
                "area": f"{dest_clean} Central Tourist Hub"
            },
            {
                "id": f"{dest_clean.lower()}-grand-comfort",
                "name": f"Hotel {dest_clean} Grand Residency",
                "tier": "comfort",
                "price_per_night": 3200.0,
                "rating": 4.6,
                "review_count": 820,
                "amenities": ["Buffet Breakfast", "Air Conditioning", "Room Service", "Mountain View"],
                "area": f"{dest_clean} Promenade / Mall Road"
            },
            {
                "id": f"{dest_clean.lower()}-royal-resort",
                "name": f"The {dest_clean} Royal Palace & Spa Resort",
                "tier": "luxury",
                "price_per_night": 7500.0,
                "rating": 4.8,
                "review_count": 1250,
                "amenities": ["Infinity Pool", "Ayurvedic Spa", "Fine Dining", "Valet Parking"],
                "area": f"{dest_clean} Scenic Valley Vista"
            }
        ]
        ranked_hotels = hotel_model.rank_hotels(
            hotel_candidates,
            user_budget_per_day=user_daily_budget,
            preferred_tier=budget_tier,
            people=people
        )

        # 3. Candidate Activities
        activity_candidates = [
            {
                "id": "act-1",
                "title": f"{dest_clean} Iconic Heritage Landmark & Architecture",
                "category": "Heritage & Culture",
                "est_cost": 100.0,
                "duration_hours": 2.5,
                "rating": 4.8,
                "description": f"Visit the famous historic monuments and architectural wonders in {dest_clean}."
            },
            {
                "id": "act-2",
                "title": f"{dest_clean} Panorama Viewpoint & Photography Trail",
                "category": "Nature & Sightseeing",
                "est_cost": 50.0,
                "duration_hours": 2.0,
                "rating": 4.7,
                "description": f"Capture sweeping landscape views, sunrise/sunset, and surrounding nature."
            },
            {
                "id": "act-3",
                "title": f"{dest_clean} Traditional Street Food & Culinary Walk",
                "category": "Food & Culture",
                "est_cost": 300.0,
                "duration_hours": 1.5,
                "rating": 4.6,
                "description": f"Sample authentic regional delicacies and local street food specialties."
            },
            {
                "id": "act-4",
                "title": f"{dest_clean} Adventure Trails & Nature Exploration",
                "category": "Adventure & Nature",
                "est_cost": 450.0,
                "duration_hours": 3.0,
                "rating": 4.9,
                "description": f"Engage in outdoor activities, hiking trails, or water sports."
            }
        ]
        ranked_activities = activity_model.rank_activities(
            activity_candidates,
            user_interests=user_interests,
            travel_pace=travel_pace
        )

        return {
            "transports": ranked_transports,
            "hotels": ranked_hotels,
            "activities": ranked_activities
        }

recommendation_engine = RecommendationEngine()
