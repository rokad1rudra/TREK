"""
Itinerary Optimization Engine
Organizes ranked spots and activities into physics-consistent multi-day itineraries.
"""

from typing import List, Dict, Any, Tuple

class ItineraryOptimizationEngine:
    def synthesize_schedule(
        self,
        origin: str,
        destination: str,
        days: int,
        distance_km: float,
        daily_cost: float,
        ranked_activities: List[Dict[str, Any]],
        ranked_hotels: List[Dict[str, Any]],
        travel_pace: str = "balanced",
        origin_coords: Tuple[float, float] = (72.8311, 21.1702),
        dest_coords: Tuple[float, float] = (75.7873, 26.9124),
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes structured day-by-day itinerary schedule.
        """
        itinerary_days = []
        hotel_name = ranked_hotels[0]["name"] if ranked_hotels else f"{destination} Central Stay"

        spots_per_day = 2 if travel_pace == "relaxed" else 4 if travel_pace == "explorer" else 3

        for d in range(1, days + 1):
            day_spots = []
            if d == 1:
                title = f"Day 1: Arrival & Check-in in {destination}"
                theme = "Journey Transit, Hotel Check-in & Evening Orientation"
                pro_tip = f"Reach hotel, unpack comfortably, and enjoy a relaxed evening walk near {hotel_name}."
                
                day_spots.append({
                    "name": f"Departure from {origin}",
                    "time": "08:00 AM",
                    "period": "morning",
                    "description": f"Commence journey from {origin} to {destination} ({distance_km} km).",
                    "lat": origin_coords[1],
                    "lng": origin_coords[0],
                    "cost_est": round(daily_cost * 0.25, 2),
                    "category": "Transit",
                    "transit_from_prev": "Departure"
                })
                day_spots.append({
                    "name": hotel_name,
                    "time": "02:30 PM",
                    "period": "afternoon",
                    "description": f"Check-in, settle luggage, and relax before evening sights.",
                    "lat": dest_coords[1],
                    "lng": dest_coords[0],
                    "cost_est": round(daily_cost * 0.40, 2),
                    "category": "Accommodation",
                    "transit_from_prev": "Hotel Transfer"
                })
                # First evening sight
                act = ranked_activities[0] if ranked_activities else None
                act_name = act["title"] if act else f"{destination} Evening Promenade"
                day_spots.append({
                    "name": act_name,
                    "time": "06:30 PM",
                    "period": "evening",
                    "description": act.get("description", "Stroll through vibrant evening bazaars and taste authentic cuisine.") if act else "Evening walk.",
                    "lat": dest_coords[1],
                    "lng": dest_coords[0],
                    "cost_est": round(daily_cost * 0.35, 2),
                    "category": "Sightseeing",
                    "transit_from_prev": "10 min walk"
                })

            elif d == days and days > 1:
                title = f"Day {d}: Final Sights, Souvenir Bazaars & Departure"
                theme = "Morning Culture Trail, Local Handicrafts & Return Journey"
                pro_tip = "Complete hotel checkout on time and store bags at reception while shopping."
                
                act = ranked_activities[min(len(ranked_activities) - 1, d)] if ranked_activities else None
                act_name = act["title"] if act else f"{destination} Artisan Bazaar"
                day_spots.append({
                    "name": act_name,
                    "time": "09:30 AM",
                    "period": "morning",
                    "description": f"Explore authentic local craft stores and heritage markets in {destination}.",
                    "lat": dest_coords[1],
                    "lng": dest_coords[0],
                    "cost_est": round(daily_cost * 0.30, 2),
                    "category": "Shopping & Heritage",
                    "transit_from_prev": "15 min drive"
                })
                day_spots.append({
                    "name": f"{destination} Farewell Lunch",
                    "time": "01:30 PM",
                    "period": "afternoon",
                    "description": f"Sample authentic regional specialties before departure.",
                    "lat": dest_coords[1],
                    "lng": dest_coords[0],
                    "cost_est": round(daily_cost * 0.35, 2),
                    "category": "Dining",
                    "transit_from_prev": "City center"
                })
                day_spots.append({
                    "name": f"Return Transit to {origin}",
                    "time": "05:00 PM",
                    "period": "evening",
                    "description": f"Return journey towards {origin} with lifetime memories.",
                    "lat": origin_coords[1],
                    "lng": origin_coords[0],
                    "cost_est": round(daily_cost * 0.35, 2),
                    "category": "Transit",
                    "transit_from_prev": f"{distance_km} km return route"
                })

            else:
                title = f"Day {d}: Deep Exploration of {destination}"
                theme = f"Curated Landmarks, Photography & Scenic Experiences"
                pro_tip = "Start early in the morning around 8:30 AM to beat midday crowds."

                idx_start = ((d - 2) * 2 + 1) % max(1, len(ranked_activities))
                for s_i in range(min(spots_per_day, len(ranked_activities))):
                    act = ranked_activities[(idx_start + s_i) % len(ranked_activities)]
                    period = "morning" if s_i == 0 else "afternoon" if s_i == 1 else "evening"
                    t_str = "09:30 AM" if s_i == 0 else "02:30 PM" if s_i == 1 else "06:30 PM"
                    day_spots.append({
                        "name": act["title"],
                        "time": t_str,
                        "period": period,
                        "description": act.get("description", "Enjoy scenic landscape and culture."),
                        "lat": dest_coords[1] + (s_i * 0.01),
                        "lng": dest_coords[0] + (s_i * 0.01),
                        "cost_est": round(daily_cost / spots_per_day, 2),
                        "category": act.get("category", "Attraction"),
                        "transit_from_prev": "15 min drive"
                    })

            itinerary_days.append({
                "day_number": d,
                "title": title,
                "theme": theme,
                "spots": day_spots,
                "daily_cost": daily_cost,
                "pro_tip": pro_tip
            })

        return itinerary_days

itinerary_engine = ItineraryOptimizationEngine()
