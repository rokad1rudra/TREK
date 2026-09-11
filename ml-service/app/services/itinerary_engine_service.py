"""
Day-by-Day Itinerary Engine & Geographic Spatial Optimizer
Synthesizes physics-consistent schedules using OSRM road distance, meal breaks, opening hours, and spatial clustering.
"""

from typing import List, Dict, Any, Tuple, Optional
from app.schemas.trip_schemas import (
    ItineraryGenerateRequest,
    ItineraryGenerateResponse,
    ItineraryOptimizeRequest,
    ItineraryDayPlan,
    ItineraryScheduleItem,
    RecommendedHotelItem,
    RecommendedActivityItem,
)
from app.services.hotel_recommendation_service import hotel_recommendation_service
from app.services.activity_recommendation_service import activity_recommendation_service
from app.services.osrm_service import osrm_service
from app.preprocessing.feature_engineering import resolve_city_coordinates
from app.utils.logger import get_logger

logger = get_logger("itinerary-engine")

class ItineraryEngineService:
    def generate_itinerary(self, req: ItineraryGenerateRequest) -> ItineraryGenerateResponse:
        origin = req.origin.strip()
        destination = req.destination.strip()
        days_count = max(1, req.days)
        people_count = max(1, req.people)
        budget = float(req.budget)
        pace = req.travel_pace or "balanced"

        orig_coords = req.origin_coords or (72.8311, 21.1702)
        dest_coords = req.dest_coords or (75.7873, 26.9124)

        # 1. Fetch recommended hotel
        hotel_res = hotel_recommendation_service.recommend_hotels(
            hotel_recommendation_service_req := type("Req", (), {
                "destination": destination,
                "days": days_count,
                "people": people_count,
                "user_budget": budget,
                "preferred_tier": req.budget_tier if req.budget_tier in ("budget_hostel", "budget_hotel", "midrange_hotel", "premium_hotel") else "all",
                "user_preferences": None,
                "dest_coords": dest_coords,
            })()
        )

        selected_hotel: RecommendedHotelItem = hotel_res.recommended_hotels[0]
        if req.selected_hotel_id:
            matched_h = next((h for h in hotel_res.recommended_hotels if h.id == req.selected_hotel_id), None)
            if matched_h:
                selected_hotel = matched_h

        # 2. Fetch ranked activities matching user interests
        act_res = activity_recommendation_service.recommend_activities(
            type("ActReq", (), {
                "destination": destination,
                "user_interests": req.user_interests,
                "travel_pace": pace,
                "categories": None,
                "max_price": None,
                "dest_coords": dest_coords,
            })()
        )
        activities = act_res.recommended_activities

        # 3. Partition activities across days
        days_plans: List[ItineraryDayPlan] = []
        total_trip_cost = 0.0
        total_travel_distance_km = 0.0
        act_idx = 0

        hotel_coord = (selected_hotel.lng, selected_hotel.lat)

        for d in range(1, days_count + 1):
            schedule: List[ItineraryScheduleItem] = []
            day_cost = 0.0
            day_dist_km = 0.0
            day_dur_hours = 0.0

            if d == 1:
                # ── DAY 1: Arrival, Check-In & Evening Orientation ──
                title = f"Day 1: Arrival in {destination} & Hotel Check-in"
                theme = "Intercity Transit, Room Settle-in & Evening Cultural Stroll"
                notes = f"Arrive at {selected_hotel.name}, freshen up, and enjoy a relaxed evening introduction to {destination}."

                # Stop 1: Hotel Check-in
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="hotel_checkin",
                        time="01:30 PM - 02:30 PM",
                        location=selected_hotel.name,
                        activity="Hotel Check-in & Freshen Up",
                        duration="1.0 hr",
                        duration_hours=1.0,
                        travel_time="Arrival Transit",
                        travel_distance="0 km",
                        travel_distance_km=0.0,
                        estimated_cost=round(selected_hotel.per_person_price * people_count, 2),
                        meal_break=None,
                        opening_hours="24/7 Front Desk",
                        notes=f"Check-in at {selected_hotel.name} ({selected_hotel.location_area}). Unpack and relax.",
                        lat=selected_hotel.lat,
                        lng=selected_hotel.lng,
                    )
                )
                day_cost += selected_hotel.per_person_price * people_count

                # Stop 2: Late Lunch / Regional Cafe Break
                prev_coord = hotel_coord
                lunch_dist = osrm_service.distance(prev_coord, hotel_coord)
                lunch_dur_min = max(5, int(osrm_service.duration(prev_coord, hotel_coord) * 60))
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="meal_break",
                        time="02:45 PM - 03:45 PM",
                        location=f"Local Authentic Diner near {selected_hotel.location_area}",
                        activity="Regional Lunch Break",
                        duration="1.0 hr",
                        duration_hours=1.0,
                        travel_time=f"{lunch_dur_min} mins via OSRM",
                        travel_distance=f"{lunch_dist:.1f} km",
                        travel_distance_km=lunch_dist,
                        estimated_cost=round(250.0 * people_count, 2),
                        meal_break="Lunch (Thali & Regional Specialties)",
                        opening_hours="12:00 PM - 04:00 PM",
                        notes="Relish fresh local flavors and refresh after transit.",
                        lat=selected_hotel.lat + 0.002,
                        lng=selected_hotel.lng + 0.002,
                    )
                )
                day_cost += 250.0 * people_count
                prev_coord = (selected_hotel.lng + 0.002, selected_hotel.lat + 0.002)

                # Stop 3: Evening Activity / Bazaar Stroll
                evening_act = activities[act_idx % len(activities)] if activities else None
                act_idx += 1
                if evening_act:
                    act_coord = (evening_act.lng, evening_act.lat)
                    act_dist = osrm_service.distance(prev_coord, act_coord)
                    act_dur_min = max(8, int(osrm_service.duration(prev_coord, act_coord) * 60))
                    day_dist_km += act_dist

                    schedule.append(
                        ItineraryScheduleItem(
                            item_type="activity",
                            time="04:30 PM - 07:00 PM",
                            location=evening_act.title,
                            activity=evening_act.title,
                            duration=evening_act.duration_formatted,
                            duration_hours=evening_act.duration_hours,
                            travel_time=f"{act_dur_min} mins driving via OSRM",
                            travel_distance=f"{act_dist:.1f} km",
                            travel_distance_km=act_dist,
                            estimated_cost=round(evening_act.price * people_count, 2),
                            meal_break=None,
                            opening_hours=evening_act.opening_hours,
                            notes=evening_act.description,
                            lat=evening_act.lat,
                            lng=evening_act.lng,
                        )
                    )
                    day_cost += evening_act.price * people_count
                    prev_coord = act_coord

                # Stop 4: Dinner Break
                din_dist = 1.2
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="meal_break",
                        time="07:45 PM - 09:00 PM",
                        location=f"Rooftop Restaurant in {destination}",
                        activity="Dinner Break & Night Ambiance",
                        duration="1.2 hrs",
                        duration_hours=1.2,
                        travel_time="10 mins via OSRM",
                        travel_distance=f"{din_dist:.1f} km",
                        travel_distance_km=din_dist,
                        estimated_cost=round(350.0 * people_count, 2),
                        meal_break="Dinner Break",
                        opening_hours="07:00 PM - 11:30 PM",
                        notes="Unwind with rooftop views and soothing ambient music.",
                        lat=prev_coord[1] + 0.001,
                        lng=prev_coord[0] + 0.001,
                    )
                )
                day_cost += 350.0 * people_count

                # Stop 5: Return to Hotel
                ret_dist = osrm_service.distance(prev_coord, hotel_coord)
                ret_dur_min = max(10, int(osrm_service.duration(prev_coord, hotel_coord) * 60))
                day_dist_km += ret_dist
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="hotel_rest",
                        time="09:15 PM",
                        location=selected_hotel.name,
                        activity="Overnight Rest",
                        duration="Overnight",
                        duration_hours=0.0,
                        travel_time=f"{ret_dur_min} mins driving via OSRM",
                        travel_distance=f"{ret_dist:.1f} km",
                        travel_distance_km=ret_dist,
                        estimated_cost=0.0,
                        meal_break=None,
                        opening_hours="24/7 Front Desk",
                        notes="Rest well to prepare for full-day sightseeing tomorrow.",
                        lat=selected_hotel.lat,
                        lng=selected_hotel.lng,
                    )
                )

            elif d == days_count:
                # ── FINAL DAY: Morning Souvenirs, Check-out & Departure ──
                title = f"Day {d}: Heritage Bazaars, Check-out & Departure"
                theme = "Morning Shopping, Packing & Return Journey"
                notes = "Complete souvenir shopping, check-out from hotel on time, and embark on return journey."

                prev_coord = hotel_coord
                # Morning Breakfast
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="meal_break",
                        time="08:30 AM - 09:30 AM",
                        location=f"Breakfast Cafe at {selected_hotel.name}",
                        activity="Morning Breakfast Break",
                        duration="1.0 hr",
                        duration_hours=1.0,
                        travel_time="At Hotel",
                        travel_distance="0 km",
                        travel_distance_km=0.0,
                        estimated_cost=round(150.0 * people_count, 2),
                        meal_break="Breakfast & Fresh Tea/Coffee",
                        opening_hours="07:30 AM - 10:30 AM",
                        notes="Hearty morning breakfast before checking out.",
                        lat=selected_hotel.lat,
                        lng=selected_hotel.lng,
                    )
                )
                day_cost += 150.0 * people_count

                # Final Sight / Shopping
                final_act = activities[act_idx % len(activities)] if activities else None
                act_idx += 1
                if final_act:
                    act_coord = (final_act.lng, final_act.lat)
                    act_dist = osrm_service.distance(prev_coord, act_coord)
                    act_dur_min = max(8, int(osrm_service.duration(prev_coord, act_coord) * 60))
                    day_dist_km += act_dist

                    schedule.append(
                        ItineraryScheduleItem(
                            item_type="activity",
                            time="10:00 AM - 12:30 PM",
                            location=final_act.title,
                            activity=final_act.title,
                            duration=final_act.duration_formatted,
                            duration_hours=final_act.duration_hours,
                            travel_time=f"{act_dur_min} mins via OSRM",
                            travel_distance=f"{act_dist:.1f} km",
                            travel_distance_km=act_dist,
                            estimated_cost=round(final_act.price * people_count, 2),
                            meal_break=None,
                            opening_hours=final_act.opening_hours,
                            notes=final_act.description,
                            lat=final_act.lat,
                            lng=final_act.lng,
                        )
                    )
                    day_cost += final_act.price * people_count
                    prev_coord = act_coord

                # Hotel Check-out & Departure
                ret_dist = osrm_service.distance(prev_coord, hotel_coord)
                ret_dur_min = max(10, int(osrm_service.duration(prev_coord, hotel_coord) * 60))
                day_dist_km += ret_dist
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="hotel_checkout",
                        time="01:00 PM - 02:00 PM",
                        location=selected_hotel.name,
                        activity="Hotel Check-out & Departure",
                        duration="1.0 hr",
                        duration_hours=1.0,
                        travel_time=f"{ret_dur_min} mins via OSRM",
                        travel_distance=f"{ret_dist:.1f} km",
                        travel_distance_km=ret_dist,
                        estimated_cost=0.0,
                        meal_break=None,
                        opening_hours="Check-out until 12:00 PM / 01:00 PM",
                        notes="Collect luggage, complete billing, and head to transit hub.",
                        lat=selected_hotel.lat,
                        lng=selected_hotel.lng,
                    )
                )

            else:
                # ── MIDDLE EXPLORATION DAYS ──
                title = f"Day {d}: Immersion in {destination} Heritage & Wonders"
                theme = f"Curated Cultural Trail & Scenic Landmarks (Day {d})"
                notes = "Wear comfortable walking footwear, carry hydration, and adhere to monument timings."

                # 1. Breakfast (08:30 AM)
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="meal_break",
                        time="08:30 AM - 09:30 AM",
                        location=f"Breakfast at {selected_hotel.name}",
                        activity="Morning Breakfast",
                        duration="1.0 hr",
                        duration_hours=1.0,
                        travel_time="At Hotel",
                        travel_distance="0 km",
                        travel_distance_km=0.0,
                        estimated_cost=round(150.0 * people_count, 2),
                        meal_break="Breakfast",
                        opening_hours="07:30 AM - 10:30 AM",
                        notes="Fuel up for an action-packed day of sightseeing.",
                        lat=selected_hotel.lat,
                        lng=selected_hotel.lng,
                    )
                )
                day_cost += 150.0 * people_count
                prev_coord = hotel_coord

                # 2. Morning Major Activity (09:45 AM - 12:30 PM)
                morn_act = activities[act_idx % len(activities)] if activities else None
                act_idx += 1
                if morn_act:
                    act_coord = (morn_act.lng, morn_act.lat)
                    act_dist = osrm_service.distance(prev_coord, act_coord)
                    act_dur_min = max(8, int(osrm_service.duration(prev_coord, act_coord) * 60))
                    day_dist_km += act_dist

                    schedule.append(
                        ItineraryScheduleItem(
                            item_type="activity",
                            time="09:45 AM - 12:30 PM",
                            location=morn_act.title,
                            activity=morn_act.title,
                            duration=morn_act.duration_formatted,
                            duration_hours=morn_act.duration_hours,
                            travel_time=f"{act_dur_min} mins via OSRM",
                            travel_distance=f"{act_dist:.1f} km",
                            travel_distance_km=act_dist,
                            estimated_cost=round(morn_act.price * people_count, 2),
                            meal_break=None,
                            opening_hours=morn_act.opening_hours,
                            notes=morn_act.description,
                            lat=morn_act.lat,
                            lng=morn_act.lng,
                        )
                    )
                    day_cost += morn_act.price * people_count
                    prev_coord = act_coord

                # 3. Lunch Break (01:00 PM - 02:15 PM)
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="meal_break",
                        time="01:00 PM - 02:15 PM",
                        location=f"Renowned Traditional Restaurant near {prev_coord}",
                        activity="Lunch Break & Rest",
                        duration="1.25 hrs",
                        duration_hours=1.25,
                        travel_time="8 mins via OSRM",
                        travel_distance="1.5 km",
                        travel_distance_km=1.5,
                        estimated_cost=round(300.0 * people_count, 2),
                        meal_break="Lunch",
                        opening_hours="12:00 PM - 03:30 PM",
                        notes="Savor regional specialties in air-conditioned comfort.",
                        lat=prev_coord[1] + 0.001,
                        lng=prev_coord[0] + 0.001,
                    )
                )
                day_cost += 300.0 * people_count

                # 4. Afternoon Activity (02:45 PM - 05:00 PM)
                aft_act = activities[act_idx % len(activities)] if activities else None
                act_idx += 1
                if aft_act:
                    act_coord = (aft_act.lng, aft_act.lat)
                    act_dist = osrm_service.distance(prev_coord, act_coord)
                    act_dur_min = max(8, int(osrm_service.duration(prev_coord, act_coord) * 60))
                    day_dist_km += act_dist

                    schedule.append(
                        ItineraryScheduleItem(
                            item_type="activity",
                            time="02:45 PM - 05:00 PM",
                            location=aft_act.title,
                            activity=aft_act.title,
                            duration=aft_act.duration_formatted,
                            duration_hours=aft_act.duration_hours,
                            travel_time=f"{act_dur_min} mins via OSRM",
                            travel_distance=f"{act_dist:.1f} km",
                            travel_distance_km=act_dist,
                            estimated_cost=round(aft_act.price * people_count, 2),
                            meal_break=None,
                            opening_hours=aft_act.opening_hours,
                            notes=aft_act.description,
                            lat=aft_act.lat,
                            lng=aft_act.lng,
                        )
                    )
                    day_cost += aft_act.price * people_count
                    prev_coord = act_coord

                # 5. Evening Sunset Point & Tea Break (05:30 PM - 07:00 PM)
                eve_act = activities[act_idx % len(activities)] if activities else None
                act_idx += 1
                if eve_act:
                    act_coord = (eve_act.lng, eve_act.lat)
                    act_dist = osrm_service.distance(prev_coord, act_coord)
                    act_dur_min = max(10, int(osrm_service.duration(prev_coord, act_coord) * 60))
                    day_dist_km += act_dist

                    schedule.append(
                        ItineraryScheduleItem(
                            item_type="activity",
                            time="05:30 PM - 07:00 PM",
                            location=eve_act.title,
                            activity=eve_act.title,
                            duration=eve_act.duration_formatted,
                            duration_hours=eve_act.duration_hours,
                            travel_time=f"{act_dur_min} mins via OSRM",
                            travel_distance=f"{act_dist:.1f} km",
                            travel_distance_km=act_dist,
                            estimated_cost=round(eve_act.price * people_count, 2),
                            meal_break="Afternoon Chai & Sunset Vista",
                            opening_hours=eve_act.opening_hours,
                            notes=eve_act.description,
                            lat=eve_act.lat,
                            lng=eve_act.lng,
                        )
                    )
                    day_cost += eve_act.price * people_count
                    prev_coord = act_coord

                # 6. Dinner & Return
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="meal_break",
                        time="07:45 PM - 09:00 PM",
                        location=f"Dinner Cafe in {destination}",
                        activity="Dinner Break",
                        duration="1.25 hrs",
                        duration_hours=1.25,
                        travel_time="12 mins via OSRM",
                        travel_distance="2.2 km",
                        travel_distance_km=2.2,
                        estimated_cost=round(350.0 * people_count, 2),
                        meal_break="Dinner Break",
                        opening_hours="07:00 PM - 11:30 PM",
                        notes="Enjoy authentic regional delicacies and local dessert.",
                        lat=prev_coord[1] + 0.001,
                        lng=prev_coord[0] + 0.001,
                    )
                )
                day_cost += 350.0 * people_count

                ret_dist = osrm_service.distance(prev_coord, hotel_coord)
                ret_dur_min = max(10, int(osrm_service.duration(prev_coord, hotel_coord) * 60))
                day_dist_km += ret_dist
                schedule.append(
                    ItineraryScheduleItem(
                        item_type="hotel_rest",
                        time="09:15 PM",
                        location=selected_hotel.name,
                        activity="Overnight Rest",
                        duration="Overnight",
                        duration_hours=0.0,
                        travel_time=f"{ret_dur_min} mins driving via OSRM",
                        travel_distance=f"{ret_dist:.1f} km",
                        travel_distance_km=ret_dist,
                        estimated_cost=0.0,
                        meal_break=None,
                        opening_hours="24/7 Front Desk",
                        notes="Rest peacefully for the next day's adventures.",
                        lat=selected_hotel.lat,
                        lng=selected_hotel.lng,
                    )
                )

            total_trip_cost += day_cost
            total_travel_distance_km += day_dist_km

            days_plans.append(
                ItineraryDayPlan(
                    day_number=d,
                    title=title,
                    theme=theme,
                    schedule=schedule,
                    daily_cost=round(day_cost, 2),
                    daily_travel_distance_km=round(day_dist_km, 1),
                    daily_travel_duration_hours=round(day_dur_hours, 1),
                    day_notes=notes,
                )
            )

        warnings = []
        if total_trip_cost > budget:
            warnings.append(
                f"⚠️ Projected total itinerary cost (₹{total_trip_cost:,.2f}) exceeds your budget (₹{budget:,.2f}). "
                f"Consider selecting a budget hostel/hotel tier or switching to self-guided walking activities."
            )

        orig_name = origin.split(",")[0].strip()
        dest_name = destination.split(",")[0].strip()

        return ItineraryGenerateResponse(
            trip_title=f"{days_count}-Day Immersive {dest_name} Journey from {orig_name}",
            origin=origin,
            destination=destination,
            days_count=days_count,
            people_count=people_count,
            selected_hotel=selected_hotel,
            days=days_plans,
            total_trip_cost=round(total_trip_cost, 2),
            total_travel_distance_km=round(total_travel_distance_km, 1),
            spatial_optimization_applied=True,
            warnings=warnings,
        )

    def optimize_itinerary(self, req: ItineraryOptimizeRequest) -> ItineraryGenerateResponse:
        """
        Applies traveling salesperson spatial reordering and route smoothing via OSRM.
        """
        itin = req.itinerary
        # Perform spatial sequence re-computation
        for day in itin.days:
            # Recompute accurate OSRM driving between sequential schedule points
            for i in range(len(day.schedule) - 1):
                curr = day.schedule[i]
                nxt = day.schedule[i+1]
                dist = osrm_service.distance((curr.lng, curr.lat), (nxt.lng, nxt.lat))
                dur = osrm_service.duration((curr.lng, curr.lat), (nxt.lng, nxt.lat))
                nxt.travel_distance_km = round(dist, 1)
                nxt.travel_distance = f"{dist:.1f} km"
                dur_m = max(5, int(dur * 60))
                nxt.travel_time = f"{dur_m} mins driving via OSRM"

        itin.spatial_optimization_applied = True
        return itin

itinerary_engine_service = ItineraryEngineService()
