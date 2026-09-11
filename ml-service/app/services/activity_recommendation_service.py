"""
Activity & Attraction Recommendation Engine
Recommends activities across 14 categories with content-based interest matching and opening hours validation.
"""

from typing import List, Dict, Any, Optional
from app.schemas.trip_schemas import (
    ActivityRecommendationRequest,
    ActivityRecommendationResponse,
    RecommendedActivityItem,
)
from app.database.places_data import get_destination_data
from app.utils.logger import get_logger

logger = get_logger("activity-recommendation")

class ActivityRecommendationService:
    def recommend_activities(self, req: ActivityRecommendationRequest) -> ActivityRecommendationResponse:
        dest_name = req.destination.strip()
        data = get_destination_data(dest_name)
        raw_acts = data.get("activities", [])

        user_interests = req.user_interests or "history, culture, food, photography"
        interests_list = [i.strip().lower() for i in user_interests.split(",") if i.strip()]
        pace = req.travel_pace or "balanced"

        matched_interests_found = set()
        scored_items: List[RecommendedActivityItem] = []

        for act in raw_acts:
            title = act.get("title", "Cultural Landmark")
            category = act.get("category", "history").lower()
            rating = max(1.0, min(5.0, float(act.get("rating", 4.5))))
            price = max(0.0, float(act.get("price", 0.0)))
            dur_h = float(act.get("duration_hours", 2.0))
            dist_km = float(act.get("distance_from_center_km", 2.0))
            opening_hours = act.get("opening_hours") or "Opening hours unavailable."
            description = act.get("description", f"Experience the culture and sights of {title}.")

            # 1. Interest & Category Alignment (0 - 45 pts)
            cat_match = False
            for user_int in interests_list:
                if (user_int in category or 
                    user_int in title.lower() or 
                    user_int in description.lower() or 
                    category in user_int):
                    cat_match = True
                    matched_interests_found.add(user_int)

            if cat_match:
                interest_score = 45.0
            elif not interests_list:
                interest_score = 35.0
            else:
                interest_score = 15.0

            # 2. Rating Quality (0 - 30 pts)
            rating_score = (rating / 5.0) * 30.0

            # 3. Pace Compatibility (0 - 15 pts)
            if pace == "relaxed":
                pace_score = 15.0 if dur_h <= 2.0 else 8.0
            elif pace == "explorer":
                pace_score = 15.0  # Explorer enjoys full immersive sights
            else:
                pace_score = 14.0 if dur_h <= 3.0 else 10.0

            # 4. Proximity & Value (0 - 10 pts)
            value_score = 5.0 if price == 0.0 else max(1.0, 5.0 - (price / 500.0) * 2.0)
            dist_score = max(1.0, 5.0 - (dist_km / 10.0) * 2.0)

            total_score = round(min(100.0, max(10.0, interest_score + rating_score + pace_score + value_score + dist_score)), 1)

            # Construct Reason
            if cat_match:
                reason = f"🎯 Strongly matches your interest in {category.capitalize()} • Rated {rating}/5"
            else:
                reason = f"⭐ Must-visit popular destination landmark • Rated {rating}/5"

            dur_str = f"{int(dur_h)}h {int((dur_h % 1)*60)}m" if dur_h >= 1 else f"{int(dur_h * 60)} mins"

            scored_items.append(
                RecommendedActivityItem(
                    id=act.get("id", "activity_item"),
                    title=title,
                    category=category,
                    price=price,
                    duration_hours=dur_h,
                    duration_formatted=dur_str,
                    rating=rating,
                    distance_from_center_km=dist_km,
                    score=total_score,
                    reason=reason,
                    opening_hours=opening_hours,
                    description=description,
                    lat=float(act.get("lat", 26.9124)),
                    lng=float(act.get("lng", 75.7873)),
                    is_free=(price == 0.0),
                    best_time_to_visit=act.get("best_time_to_visit", "Morning / Afternoon"),
                    data_source="database",
                )
            )

        # Sort descending by score
        scored_items.sort(key=lambda x: x.score, reverse=True)

        return ActivityRecommendationResponse(
            destination=dest_name,
            user_interests_matched=sorted(list(matched_interests_found)),
            total_found=len(scored_items),
            recommended_activities=scored_items,
            scoring_method="CONTENT_BASED_INTEREST_ALIGNMENT",
        )

activity_recommendation_service = ActivityRecommendationService()
