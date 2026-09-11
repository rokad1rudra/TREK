"""
Hotel & Hostel Recommendation Engine
Recommends verified accommodations across Budget Hostel, Budget Hotel, Mid-Range, and Premium tiers with transparent scoring.
"""

from typing import List, Dict, Any, Optional
from app.schemas.trip_schemas import (
    HotelRecommendationRequest,
    HotelRecommendationResponse,
    RecommendedHotelItem,
    HotelTier,
)
from app.database.places_data import get_destination_data
from app.utils.logger import get_logger

logger = get_logger("hotel-recommendation")

class HotelRecommendationService:
    def recommend_hotels(self, req: HotelRecommendationRequest) -> HotelRecommendationResponse:
        dest_name = req.destination.strip()
        data = get_destination_data(dest_name)
        raw_hotels = data.get("hotels", [])

        people = max(1, req.people)
        days = max(1, req.days)
        user_budget = req.user_budget or 20000.0
        daily_stay_budget = (user_budget * 0.35) / max(1, days - 1)

        scored_items: List[RecommendedHotelItem] = []

        for h in raw_hotels:
            price = max(400.0, float(h.get("price_per_night", 2000.0)))
            rating = max(1.0, min(5.0, float(h.get("rating", 4.2))))
            reviews = max(10, int(h.get("review_count", 100)))
            dist_km = float(h.get("distance_to_center_km", 2.0))
            tier = h.get("tier", "budget_hotel")
            amenities = h.get("amenities", ["Free Wi-Fi", "Air Conditioning"])

            # 1. Rating Quality (0 - 30 pts)
            rating_score = (rating / 5.0) * 30.0

            # 2. Budget Compatibility (0 - 35 pts)
            rooms = max(1, (people + 1) // 2) if tier != "budget_hostel" else max(1, (people + 3) // 4)
            room_cost = price * rooms
            if room_cost <= daily_stay_budget * 1.15:
                budget_score = 35.0
            elif room_cost <= daily_stay_budget * 1.5:
                budget_score = 25.0
            else:
                budget_score = max(5.0, 35.0 - ((room_cost - daily_stay_budget) / daily_stay_budget) * 20.0)

            # 3. Distance to Center (0 - 15 pts)
            dist_score = max(2.0, 15.0 - (dist_km * 1.2))

            # 4. Preferred Tier Alignment (0 - 10 pts)
            if req.preferred_tier == "all" or req.preferred_tier == tier:
                tier_score = 10.0
            else:
                tier_score = 4.0

            # 5. Amenities & Review Density (0 - 10 pts)
            review_bonus = min(5.0, (reviews / 2000.0) * 5.0)
            amenity_bonus = min(5.0, len(amenities) * 1.0)
            bonus_score = review_bonus + amenity_bonus

            total_score = round(min(100.0, max(10.0, rating_score + budget_score + dist_score + tier_score + bonus_score)), 1)

            # Generate transparent reasons
            reasons = [
                f"⭐ Rated {rating}/5 based on {reviews:,} reviews",
                f"💰 ₹{price:,.0f}/night (Est. ₹{room_cost/people:,.0f}/person/night)",
                f"📍 {dist_km} km from city center ({h.get('location_area', 'Prime Area')})",
            ]
            if "Rooftop" in " ".join(amenities) or "Pool" in " ".join(amenities):
                reasons.append(f"✨ Highlights: {', '.join(amenities[:2])}")

            scored_items.append(
                RecommendedHotelItem(
                    id=h.get("id", "hotel_item"),
                    name=h.get("name", "Boutique Residency"),
                    tier=tier,  # type: ignore
                    price_per_night=price,
                    per_person_price=round(room_cost / people, 2),
                    rating=rating,
                    review_count=reviews,
                    distance_to_center_km=dist_km,
                    location_area=h.get("location_area", "Central"),
                    amenities=amenities,
                    score=total_score,
                    reasons=reasons,
                    booking_url=h.get("booking_url", ""),
                    google_hotels_url=h.get("google_hotels_url", ""),
                    lat=float(h.get("lat", 26.9124)),
                    lng=float(h.get("lng", 75.7873)),
                    data_source="database",
                )
            )

        # Sort descending by score
        scored_items.sort(key=lambda x: x.score, reverse=True)

        top_hostel = next((h for h in scored_items if h.tier == "budget_hostel"), None)
        top_b_hotel = next((h for h in scored_items if h.tier == "budget_hotel"), None)
        top_midrange = next((h for h in scored_items if h.tier == "midrange_hotel"), None)
        top_premium = next((h for h in scored_items if h.tier == "premium_hotel"), None)

        return HotelRecommendationResponse(
            destination=dest_name,
            total_found=len(scored_items),
            recommended_hotels=scored_items,
            top_budget_hostel=top_hostel,
            top_budget_hotel=top_b_hotel,
            top_midrange_hotel=top_midrange,
            top_premium_hotel=top_premium,
            scoring_method="DETERMINISTIC_MULTI_CRITERIA",
        )

hotel_recommendation_service = HotelRecommendationService()
