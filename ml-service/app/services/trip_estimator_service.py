"""
Trip Estimator Service
Coordinates OSRM road routing + Multimodal Transport Ranking + Granular Budget Engine + Optimization.
"""

from typing import Dict, Any, Tuple, Optional
from app.schemas.trip_schemas import (
    TripEstimateRequest,
    TripEstimateResponse,
)
from app.services.osrm_service import osrm_service
from app.services.transport_service import transport_intelligence_service
from app.services.budget_service import budget_intelligence_service
from app.services.budget_optimizer import budget_optimizer
from app.preprocessing.feature_engineering import resolve_city_coordinates
from app.utils.logger import get_logger

logger = get_logger("trip-estimator-service")

class TripEstimatorService:
    def estimate_trip(self, req: TripEstimateRequest) -> TripEstimateResponse:
        origin = req.origin.strip()
        destination = req.destination.strip()
        people = max(1, req.people)
        days = max(1, req.days)
        budget = float(req.budget)

        # 1. Resolve coordinates
        orig_info = resolve_city_coordinates(origin)
        dest_info = resolve_city_coordinates(destination)

        orig_coords = req.origin_coords or (orig_info["lng"], orig_info["lat"])
        dest_coords = req.dest_coords or (dest_info["lng"], dest_info["lat"])

        # 2. Query OSRM for true road distance & duration
        road_distance_km = osrm_service.distance(orig_coords, dest_coords)
        road_driving_hours = osrm_service.duration(orig_coords, dest_coords)

        if road_distance_km <= 0:
            road_distance_km = 450.0
            road_driving_hours = 7.5

        # 3. Generate candidate transport options
        candidates = transport_intelligence_service.generate_candidate_options(
            origin=origin,
            destination=destination,
            people=people,
            user_budget=budget,
            origin_coords=orig_coords,
            dest_coords=dest_coords,
        )

        # 4. Rank transport options with configurable weights
        ranked_trans_res = transport_intelligence_service.rank_options(
            options=candidates,
            user_budget=budget,
            people=people,
            ranking_mode=req.ranking_mode,
            custom_weights=req.custom_weights,
            distance_km=road_distance_km,
        )
        selected_trans = ranked_trans_res.ranked_options[0].option if ranked_trans_res.ranked_options else candidates[0]

        # 5. Calculate Itemized Budget Breakdown
        initial_breakdown = budget_intelligence_service.calculate_itemized_budget(
            distance_km=road_distance_km,
            days=days,
            people=people,
            tier=req.budget_tier,
            selected_transport_type=selected_trans.type,
            custom_transport_cost_pp=selected_trans.price_per_person,
            custom_total_budget=budget if req.budget_tier == "custom" else None,
        )

        # 6. Generate Tier Comparison
        tier_comparisons = budget_intelligence_service.generate_tier_comparisons(
            distance_km=road_distance_km,
            days=days,
            people=people,
        )

        # 7. Apply Budget Optimization
        opt_res = budget_optimizer.optimize(
            original_breakdown=initial_breakdown,
            user_budget=budget,
            distance_km=road_distance_km,
            days=days,
            people=people,
            initial_tier=req.budget_tier,
        )

        # 8. Highlights
        highlights = [
            f"🚗 Road Corridor: ~{road_distance_km} km ({road_driving_hours} hrs driving via OSRM)",
            f"🚆 Top Ranked Transit: {selected_trans.title} (Score: {ranked_trans_res.ranked_options[0].transport_score}/100)",
            f"💰 Estimated Budget: ₹{initial_breakdown.total_cost:,.2f} for {people} people",
        ]
        if opt_res.is_optimized and opt_res.money_saved > 0:
            highlights.append(f"💡 Optimization Applied: Saved ₹{opt_res.money_saved:,.2f} across stay, commute & transit")
        if opt_res.feasibility_warning:
            highlights.append(opt_res.feasibility_warning)

        orig_name = origin.split(",")[0].strip()
        dest_name = destination.split(",")[0].strip()

        return TripEstimateResponse(
            trip_title=f"{days}-Day {orig_name} to {dest_name} Journey Estimate",
            origin=origin,
            destination=destination,
            distance_km=road_distance_km,
            driving_duration_hours=road_driving_hours,
            road_data_source="osrm_road_engine",
            travelers_count=people,
            days_count=days,
            user_budget=budget,
            selected_transport=selected_trans,
            all_ranked_transports=ranked_trans_res.ranked_options,
            budget_breakdown=initial_breakdown,
            budget_optimization=opt_res,
            tier_options=tier_comparisons,
            itinerary_highlights=highlights,
            model_version="2.0.0-ml-transport-budget",
        )

trip_estimator_service = TripEstimatorService()
