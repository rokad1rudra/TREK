"""
Transport Options Generator Service
Generates multimodal candidate transports using OSRM for road metrics and realistic domain data with transparent provenance.
"""

from typing import List, Dict, Any, Tuple, Optional
from app.schemas.trip_schemas import (
    TransportOption,
    TransportOptionsRequest,
    TransportRankResponse,
    RankingWeights,
    TransportCategory,
)
from app.services.osrm_service import osrm_service
from app.models.transport_model import transport_rank_model, WEIGHT_PRESETS
from app.preprocessing.feature_engineering import resolve_city_coordinates
from app.database.mongo import get_mongo_db
from app.database.supabase_client import get_supabase
from app.utils.logger import get_logger

logger = get_logger("transport-service")

class TransportIntelligenceService:
    def generate_candidate_options(
        self,
        origin: str,
        destination: str,
        people: int = 2,
        user_budget: Optional[float] = None,
        origin_coords: Optional[Tuple[float, float]] = None,
        dest_coords: Optional[Tuple[float, float]] = None,
    ) -> List[TransportOption]:
        """
        Generates candidates across all supported transport modes.
        Uses OSRM for road distance, duration, and road geometry.
        """
        # Resolve coordinates
        orig_info = resolve_city_coordinates(origin)
        dest_info = resolve_city_coordinates(destination)

        orig_c = origin_coords or (orig_info["lng"], orig_info["lat"])
        dest_c = dest_coords or (dest_info["lng"], dest_info["lat"])

        # 1. Query OSRM for true road distance & duration
        road_distance_km = osrm_service.distance(orig_c, dest_c)
        road_driving_hours = osrm_service.duration(orig_c, dest_c)

        if road_distance_km <= 0:
            # Fallback distance if points are identical or offline
            road_distance_km = 450.0
            road_driving_hours = 7.5

        # Check for route geometry from OSRM
        try:
            route_res = osrm_service.route([orig_c, dest_c], overview="simplified")
            road_geometry = route_res.get("routes", [{}])[0].get("geometry")
        except Exception:
            road_geometry = None

        orig_name = origin.split(",")[0].strip()
        dest_name = destination.split(",")[0].strip()

        candidates: List[TransportOption] = []

        # ── 1. Train (Superfast / 3AC / Sleeper) ──
        train_duration = max(2.5, round(road_distance_km / 68.0 + 0.5, 1))
        train_price_pp = max(380.0, round(road_distance_km * 1.15, 2))
        candidates.append(
            TransportOption(
                id="train_superfast",
                type="train",
                title=f"🚆 Superfast Express (3AC / Sleeper)",
                operator_or_service="Indian Railways / IRCTC",
                class_or_tier="3AC / Sleeper Berth",
                price_per_person=train_price_pp,
                total_cost_for_group=round(train_price_pp * people, 2),
                duration_hours=train_duration,
                duration_formatted=self._fmt_duration(train_duration),
                distance_km=round(road_distance_km * 0.95, 1),  # Rail alignment
                comfort_rating=4.3,
                availability_score=0.92,
                departure_time="07:30 AM",
                arrival_time=self._calc_arrival("07:30 AM", train_duration),
                data_source="estimated",
                co2_emissions_kg=round(road_distance_km * 0.041 * people, 1),
                description=f"Direct rail transit from {orig_name} to {dest_name} with confirmed berths and scenic countryside views.",
                suitability_tag="Budget & Comfort Balance",
                suitability_color="emerald",
            )
        )

        # ── 2. Intercity Bus (Volvo AC Multi-Axle Sleeper) ──
        bus_duration = max(3.0, round(road_driving_hours * 1.15, 1))
        bus_price_pp = max(550.0, round(road_distance_km * 1.45, 2))
        candidates.append(
            TransportOption(
                id="bus_intercity_volvo",
                type="intercity_bus",
                title=f"🚌 Intercity Volvo Multi-Axle AC Sleeper",
                operator_or_service="Private AC Luxury Coaches / Zingbus / Intrcity",
                class_or_tier="AC Sleeper (2+1)",
                price_per_person=bus_price_pp,
                total_cost_for_group=round(bus_price_pp * people, 2),
                duration_hours=bus_duration,
                duration_formatted=self._fmt_duration(bus_duration),
                distance_km=road_distance_km,
                comfort_rating=4.1,
                availability_score=0.96,
                departure_time="09:00 PM",
                arrival_time=self._calc_arrival("09:00 PM", bus_duration),
                data_source="osrm_road_engine",
                route_geometry=road_geometry,
                co2_emissions_kg=round(road_distance_km * 0.068 * people, 1),
                description=f"Overnight sleeper bus connecting {orig_name} and {dest_name} with charging ports and water bottle.",
                suitability_tag="Flexible Overnight Transit",
                suitability_color="sky",
            )
        )

        # ── 3. Central State Bus (RTC Express) ──
        rtc_duration = max(3.5, round(road_driving_hours * 1.3, 1))
        rtc_price_pp = max(300.0, round(road_distance_km * 0.95, 2))
        candidates.append(
            TransportOption(
                id="bus_central_rtc",
                type="central_bus",
                title=f"🚌 State Transport Central RTC Express",
                operator_or_service="State Road Transport Corporation (GSRTC / MSRTC / RSRTC)",
                class_or_tier="Express Seater",
                price_per_person=rtc_price_pp,
                total_cost_for_group=round(rtc_price_pp * people, 2),
                duration_hours=rtc_duration,
                duration_formatted=self._fmt_duration(rtc_duration),
                distance_km=road_distance_km,
                comfort_rating=3.5,
                availability_score=0.98,
                departure_time="06:00 AM",
                arrival_time=self._calc_arrival("06:00 AM", rtc_duration),
                data_source="osrm_road_engine",
                route_geometry=road_geometry,
                co2_emissions_kg=round(road_distance_km * 0.055 * people, 1),
                description=f"Economical state transport bus with frequent departures from central bus stations.",
                suitability_tag="Lowest Cost Transit",
                suitability_color="amber",
            )
        )

        # ── 4. Flight (If distance > 250km) ──
        if road_distance_km >= 250.0:
            flight_duration = 1.5 + round(road_distance_km / 650.0, 1)  # Flight time + airport overhead
            flight_price_pp = max(2800.0, round(road_distance_km * 4.4, 2))
            candidates.append(
                TransportOption(
                    id="flight_express",
                    type="flight",
                    title=f"✈️ Domestic Flight + Airport Transfer",
                    operator_or_service="IndiGo / Air India / SpiceJet",
                    class_or_tier="Economy Direct / Connecting",
                    price_per_person=flight_price_pp,
                    total_cost_for_group=round(flight_price_pp * people, 2),
                    duration_hours=flight_duration,
                    duration_formatted=self._fmt_duration(flight_duration),
                    distance_km=round(road_distance_km * 0.8, 1),  # Direct aerial corridor
                    comfort_rating=4.7,
                    availability_score=0.88,
                    departure_time="10:15 AM",
                    arrival_time=self._calc_arrival("10:15 AM", flight_duration),
                    data_source="estimated",
                    co2_emissions_kg=round(road_distance_km * 0.155 * people, 1),
                    description=f"Fastest travel option for long distances with standard 15kg baggage allowance.",
                    suitability_tag="Fastest Travel Mode",
                    suitability_color="purple",
                )
            )

        # ── 5. Private Cab / Taxi (Sedan / SUV) ──
        cab_duration = round(road_driving_hours, 1)
        cab_total = max(1800.0, round(road_distance_km * 11.5 + 400.0, 2))  # Toll + per km
        cab_price_pp = round(cab_total / people, 2)
        candidates.append(
            TransportOption(
                id="taxi_outstation",
                type="taxi",
                title=f"🚖 Outstation Cab (Dedicated AC Sedan / Ertiga)",
                operator_or_service="MakeMyTrip / Savaari / Uber Intercity",
                class_or_tier="Private AC Cab",
                price_per_person=cab_price_pp,
                total_cost_for_group=cab_total,
                duration_hours=cab_duration,
                duration_formatted=self._fmt_duration(cab_duration),
                distance_km=road_distance_km,
                comfort_rating=4.8,
                availability_score=0.99,
                departure_time="On Demand",
                arrival_time=f"+{int(cab_duration)} hrs",
                data_source="osrm_road_engine",
                route_geometry=road_geometry,
                co2_emissions_kg=round(road_distance_km * 0.12, 1),
                description=f"Door-to-door private cab with customizable stopovers, toll tax, and driver allowance included.",
                suitability_tag="Maximum Comfort & Door-to-Door",
                suitability_color="sky",
            )
        )

        # ── 6. Self-Drive Car Road Trip ──
        car_duration = round(road_driving_hours, 1)
        fuel_and_toll_total = max(1200.0, round(road_distance_km * 7.5 + 300.0, 2))
        car_price_pp = round(fuel_and_toll_total / people, 2)
        candidates.append(
            TransportOption(
                id="car_self_drive",
                type="car",
                title=f"🚗 Self-Drive Car / Road Drive",
                operator_or_service="Zoomcar / Revv / Personal Car",
                class_or_tier="Self-Drive SUV / Hatchback",
                price_per_person=car_price_pp,
                total_cost_for_group=fuel_and_toll_total,
                duration_hours=car_duration,
                duration_formatted=self._fmt_duration(car_duration),
                distance_km=road_distance_km,
                comfort_rating=4.5,
                availability_score=0.95,
                departure_time="Flexible",
                arrival_time=f"+{int(car_duration)} hrs",
                data_source="osrm_road_engine",
                route_geometry=road_geometry,
                co2_emissions_kg=round(road_distance_km * 0.11, 1),
                description=f"Drive your own vehicle or self-drive rental along National Highways with freedom of schedule.",
                suitability_tag="Scenic Highway Explorer",
                suitability_color="amber",
            )
        )

        # ── 7. Motorbike Touring (if road_distance_km < 600km) ──
        if road_distance_km <= 600.0:
            bike_duration = round(road_driving_hours * 1.1, 1)
            bike_total = max(600.0, round(road_distance_km * 3.2, 2))
            bike_pp = round(bike_total / min(2, people), 2)
            candidates.append(
                TransportOption(
                    id="bike_touring",
                    type="bike",
                    title=f"🏍️ Touring Motorcycle / Royal Enfield",
                    operator_or_service="Royal Brothers / Local Bike Rental",
                    class_or_tier="350cc Cruiser",
                    price_per_person=bike_pp,
                    total_cost_for_group=bike_total * max(1, (people + 1) // 2),
                    duration_hours=bike_duration,
                    duration_formatted=self._fmt_duration(bike_duration),
                    distance_km=road_distance_km,
                    comfort_rating=3.8,
                    availability_score=0.90,
                    departure_time="06:30 AM",
                    arrival_time=self._calc_arrival("06:30 AM", bike_duration),
                    data_source="osrm_road_engine",
                    route_geometry=road_geometry,
                    co2_emissions_kg=round(road_distance_km * 0.045, 1),
                    description=f"Adventure motorbike tour through ghats and scenic state corridors with helmet & safety gear.",
                    suitability_tag="Adventure Road Trip",
                    suitability_color="amber",
                )
            )

        # ── 8. Urban Local Connectors (Metro, Auto, Walking for micro distances) ──
        if road_distance_km <= 40.0:
            # Auto / Rickshaw
            auto_dur = round(road_distance_km / 22.0, 1)
            auto_cost = max(50.0, round(road_distance_km * 14.0, 2))
            candidates.append(
                TransportOption(
                    id="auto_rickshaw",
                    type="auto_rickshaw",
                    title=f"🛺 Auto Rickshaw / Shared E-Rickshaw",
                    operator_or_service="City Auto Union / Ola Auto",
                    class_or_tier="CNG / Electric Auto",
                    price_per_person=round(auto_cost / people, 2),
                    total_cost_for_group=auto_cost,
                    duration_hours=auto_dur,
                    duration_formatted=self._fmt_duration(auto_dur),
                    distance_km=road_distance_km,
                    comfort_rating=3.6,
                    availability_score=0.99,
                    data_source="osrm_road_engine",
                    description="Ideal for quick point-to-point intra-city transit without parking hassles.",
                    suitability_tag="City Street Navigator",
                    suitability_color="emerald",
                )
            )
            # Walking
            if road_distance_km <= 5.0:
                walk_dur = round(road_distance_km / 4.5, 1)
                candidates.append(
                    TransportOption(
                        id="walking_tour",
                        type="walking",
                        title=f"🚶 Heritage Walk & Pedestrian Trail",
                        operator_or_service="Self-Guided",
                        class_or_tier="Pedestrian",
                        price_per_person=0.0,
                        total_cost_for_group=0.0,
                        duration_hours=walk_dur,
                        duration_formatted=self._fmt_duration(walk_dur),
                        distance_km=road_distance_km,
                        comfort_rating=4.0,
                        availability_score=1.0,
                        data_source="osrm_road_engine",
                        description="Zero emission walking route through bazaar lanes and heritage monuments.",
                        suitability_tag="100% Free & Eco-Friendly",
                        suitability_color="emerald",
                    )
                )

        return candidates

    def rank_options(
        self,
        options: List[TransportOption],
        user_budget: float,
        people: int = 2,
        ranking_mode: str = "balanced",
        custom_weights: Optional[RankingWeights] = None,
        distance_km: float = 400.0,
    ) -> TransportRankResponse:
        """Ranks candidates and structures rank response."""
        per_person_budget = user_budget / max(1, people)
        ranked = transport_rank_model.rank_candidates(
            candidates=options,
            user_budget_per_person=per_person_budget,
            people=people,
            ranking_mode=ranking_mode,
            custom_weights=custom_weights,
            distance_km=distance_km,
        )

        weights = custom_weights if (ranking_mode == "custom" and custom_weights) else WEIGHT_PRESETS.get(ranking_mode, WEIGHT_PRESETS["balanced"])

        top_rec = ranked[0].option.id if ranked else ""
        fastest_opt = min(ranked, key=lambda x: x.option.duration_hours).option.id if ranked else ""
        cheapest_opt = min(ranked, key=lambda x: x.option.price_per_person).option.id if ranked else ""
        most_comf = max(ranked, key=lambda x: x.option.comfort_rating).option.id if ranked else ""

        return TransportRankResponse(
            ranking_mode=ranking_mode,
            active_weights=weights.normalized(),
            ranked_options=ranked,
            top_recommended_id=top_rec,
            fastest_option_id=fastest_opt,
            cheapest_option_id=cheapest_opt,
            most_comfortable_id=most_comf,
        )

    def _fmt_duration(self, duration_hours: float) -> str:
        hours = int(duration_hours)
        minutes = int(round((duration_hours - hours) * 60))
        if hours > 0 and minutes > 0:
            return f"{hours}h {minutes}m"
        elif hours > 0:
            return f"{hours} hrs"
        else:
            return f"{max(1, minutes)} mins"

    def _calc_arrival(self, departure_str: str, duration_hours: float) -> str:
        try:
            # Simple clock arithmetic
            parts = departure_str.replace("AM", "").replace("PM", "").strip().split(":")
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            if "PM" in departure_str and h != 12:
                h += 12
            elif "AM" in departure_str and h == 12:
                h = 0

            total_mins = int(h * 60 + m + duration_hours * 60)
            arr_h = (total_mins // 60) % 24
            arr_m = total_mins % 60
            period = "PM" if arr_h >= 12 else "AM"
            display_h = arr_h if arr_h in (0, 12) else arr_h % 12
            if display_h == 0:
                display_h = 12
            return f"{display_h:02d}:{arr_m:02d} {period}"
        except Exception:
            return f"+{int(duration_hours)} hrs"

transport_intelligence_service = TransportIntelligenceService()
