"""
Hotel Recommendation & Ranking Model
Ranks hotels based on price, user budget, rating, review density, and tier alignment.
"""

from typing import List, Dict, Any

class HotelRankModel:
    def rank_hotels(
        self,
        hotels: List[Dict[str, Any]],
        user_budget_per_day: float,
        preferred_tier: str = "budget",
        people: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Calculates ranking scores for hotel options.
        """
        scored_hotels = []

        for h in hotels:
            price = max(500.0, float(h.get("price_per_night", 2000.0)))
            rating = max(1.0, min(5.0, float(h.get("rating", 4.2))))
            reviews = max(1, int(h.get("review_count", 50)))
            tier = h.get("tier", "budget").lower()

            # 1. Rating Quality (0-40 pts)
            rating_score = (rating / 5.0) * 40.0

            # 2. Budget Proximity & Value (0-40 pts)
            budget_ratio = price / max(500.0, user_budget_per_day)
            if 0.5 <= budget_ratio <= 1.2:
                budget_score = 40.0
            elif budget_ratio < 0.5:
                budget_score = 35.0  # Great value
            else:
                budget_score = max(5.0, 40.0 - (budget_ratio - 1.2) * 20.0)

            # 3. Preferred Tier Match (0-20 pts)
            tier_match_score = 20.0 if tier == preferred_tier.lower() else 10.0

            final_score = round(min(100.0, rating_score + budget_score + tier_match_score), 1)

            rooms = max(1, (people + 1) // 2) if tier != "budget" else max(1, (people + 3) // 4)
            per_person_night = round((price * rooms) / max(1, people), 2)

            name = h.get("name", "Boutique Hotel")
            booking_url = h.get("booking_url", f"https://www.booking.com/searchresults.html?ss={name.replace(' ', '+')}")
            google_url = h.get("google_hotels_url", f"https://www.google.com/travel/hotels?q={name.replace(' ', '+')}")

            scored_hotels.append({
                "id": h.get("id", str(name.lower().replace(" ", "-"))),
                "name": name,
                "tier": tier,
                "score": final_score,
                "price_per_night": price,
                "per_person_price": per_person_night,
                "rating": rating,
                "review_count": reviews,
                "amenities": h.get("amenities", ["Free Wi-Fi", "Air Conditioning", "Breakfast Available"]),
                "area": h.get("area", "City Center & Tourist Corridor"),
                "booking_url": booking_url,
                "google_hotels_url": google_url
            })

        # Sort descending by score
        scored_hotels.sort(key=lambda x: x["score"], reverse=True)

        for idx, item in enumerate(scored_hotels):
            item["rank"] = idx + 1

        return scored_hotels

hotel_model = HotelRankModel()
