"""
FastAPI Route Definitions for ML Microservice
Exposes REST endpoints for Transport Intelligence, Budget Optimization, Hotel/Activity Recommendations, and Itinerary Synthesis.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, status
from app.schemas.trip_schemas import (
    TripPredictionRequest,
    TripPredictionResponse,
    TransportOptionsRequest,
    TransportRankRequest,
    TransportRankResponse,
    BudgetCalculateRequest,
    BudgetCalculateResponse,
    TripEstimateRequest,
    TripEstimateResponse,
    HotelRecommendationRequest,
    HotelRecommendationResponse,
    ActivityRecommendationRequest,
    ActivityRecommendationResponse,
    ItineraryGenerateRequest,
    ItineraryGenerateResponse,
    ItineraryOptimizeRequest,
    CostPredictionInput,
    CostPredictionOutput,
    TransportRankInput,
    TransportRankOutput,
    HotelRankInput,
    HotelRankOutput,
    ActivityRankInput,
    ActivityRankOutput,
)
from app.schemas.osrm_schemas import (
    OSRMRouteRequest,
    OSRMMatrixRequest,
)
from app.services.transport_service import transport_intelligence_service
from app.services.budget_service import budget_intelligence_service
from app.services.budget_optimizer import budget_optimizer
from app.services.trip_estimator_service import trip_estimator_service
from app.services.hotel_recommendation_service import hotel_recommendation_service
from app.services.activity_recommendation_service import activity_recommendation_service
from app.services.itinerary_engine_service import itinerary_engine_service
from app.services.prediction_service import prediction_service
from app.services.osrm_service import osrm_service
from app.inference.engine import inference_engine
from app.models.transport_model import transport_rank_model
from app.models.hotel_model import hotel_model
from app.models.activity_model import activity_model
from app.services.end_to_end_planner_service import end_to_end_planner_service
from app.utils.logger import get_logger

logger = get_logger("api-routes")
router = APIRouter()

# ── Health Check ──
@router.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "Trip Planning ML Microservice",
        "version": "4.0.0",
        "framework": "FastAPI",
        "ml_engine": "Scikit-learn + Joblib",
        "modules": [
            "Complete End-to-End AI Trip Planner (15-Step Pipeline)",
            "Transport Intelligence (Train, Bus, Flight, Cab, Car, Bike, Metro, Auto, Walking)",
            "Budget Engine (Budget, Standard, Premium, Custom)",
            "Budget Optimization (5-Stage Cost Reduction & Feasibility Warnings)",
            "Hotel & Hostel Recommendation Engine (4 Tiers with Realistic Pricing)",
            "Activity Recommendation Engine (14 Interest Categories & Opening Hours)",
            "Day-by-Day Itinerary Engine & OSRM Geographic Road Optimization",
            "OSRM Road Routing Engine",
            "Supabase RAG & Destination Knowledge Base",
            "Pluggable Ollama & Heuristic NLU Interface"
        ]
    }

# ── FINAL: Complete End-to-End AI Trip Planner Endpoint ──

@router.post("/plan", tags=["Master Planner"])
async def plan_trip_end_to_end(payload: Dict[str, Any]):
    """
    Complete End-to-End AI Trip Planner:
    Accepts natural language message or structured payload, executes the 15-step pipeline,
    and returns comprehensive plan with transport, hotels, activities, itinerary, budget, optimization, and provenance.
    """
    try:
        return end_to_end_planner_service.plan_trip(payload)
    except Exception as e:
        logger.error(f"Error planning trip: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PART 3: Hotel & Hostel Recommendations ──

@router.post("/recommend/hotels", response_model=HotelRecommendationResponse, tags=["Accommodation Engine"])
async def recommend_hotels(req: HotelRecommendationRequest):
    """
    Recommends verified accommodations across budget hostels, budget hotels, mid-range, and premium tiers.
    """
    try:
        return hotel_recommendation_service.recommend_hotels(req)
    except Exception as e:
        logger.error(f"Error recommending hotels: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PART 3: Activity & Sightseeing Recommendations ──

@router.post("/recommend/activities", response_model=ActivityRecommendationResponse, tags=["Activity Engine"])
async def recommend_activities(req: ActivityRecommendationRequest):
    """
    Recommends tourist sights and experiences across 14 categories with verified opening hours and interest alignment.
    """
    try:
        return activity_recommendation_service.recommend_activities(req)
    except Exception as e:
        logger.error(f"Error recommending activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PART 3: Day-by-Day Itinerary Engine & Optimization ──

@router.post("/itinerary/generate", response_model=ItineraryGenerateResponse, tags=["Itinerary Engine"])
async def generate_itinerary(req: ItineraryGenerateRequest):
    """
    Synthesizes physics-consistent, day-by-day schedules with OSRM road travel calculations, meal breaks, and opening hour checks.
    """
    try:
        return itinerary_engine_service.generate_itinerary(req)
    except Exception as e:
        logger.error(f"Error generating itinerary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/itinerary/optimize", response_model=ItineraryGenerateResponse, tags=["Itinerary Engine"])
async def optimize_itinerary(req: ItineraryOptimizeRequest):
    """
    Applies spatial route clustering and traveling-salesperson route smoothing using OSRM.
    """
    try:
        return itinerary_engine_service.optimize_itinerary(req)
    except Exception as e:
        logger.error(f"Error optimizing itinerary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PART 2: Transport Intelligence Endpoints ──

@router.post("/transport/options", response_model=List[Dict[str, Any]], tags=["Transport Intelligence"])
async def get_transport_options(req: TransportOptionsRequest):
    try:
        candidates = transport_intelligence_service.generate_candidate_options(
            origin=req.origin,
            destination=req.destination,
            people=req.people,
            user_budget=req.user_budget,
            origin_coords=req.origin_coords,
            dest_coords=req.dest_coords,
        )
        return [c.model_dump() for c in candidates]
    except Exception as e:
        logger.error(f"Error generating transport options: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transport/rank", response_model=TransportRankResponse, tags=["Transport Intelligence"])
async def rank_transport_options(req: TransportRankRequest):
    try:
        return transport_intelligence_service.rank_options(
            options=req.options,
            user_budget=req.user_budget,
            people=req.people,
            ranking_mode=req.ranking_mode,
            custom_weights=req.custom_weights,
            distance_km=req.distance_km,
        )
    except Exception as e:
        logger.error(f"Error ranking transport options: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PART 2: Budget Calculation & Optimization Endpoints ──

@router.post("/budget/calculate", response_model=BudgetCalculateResponse, tags=["Budget Engine"])
async def calculate_budget(req: BudgetCalculateRequest):
    try:
        road_distance_km = 450.0

        breakdown = budget_intelligence_service.calculate_itemized_budget(
            distance_km=road_distance_km,
            days=req.days,
            people=req.people,
            tier=req.budget_tier,
            selected_transport_type=req.selected_transport_type,
            custom_transport_cost_pp=req.selected_transport_cost_per_person,
            custom_total_budget=req.user_budget if req.budget_tier == "custom" else None,
        )

        tier_comparisons = budget_intelligence_service.generate_tier_comparisons(
            distance_km=road_distance_km,
            days=req.days,
            people=req.people,
        )

        opt_result = budget_optimizer.optimize(
            original_breakdown=breakdown,
            user_budget=req.user_budget,
            distance_km=road_distance_km,
            days=req.days,
            people=req.people,
            initial_tier=req.budget_tier,
        )

        total = breakdown.total_cost or 1.0
        allocation_pcts = {
            "transport": round((breakdown.transport_cost / total) * 100, 1),
            "accommodation": round((breakdown.accommodation_cost / total) * 100, 1),
            "food": round((breakdown.food_cost / total) * 100, 1),
            "local_transport": round((breakdown.local_transport_cost / total) * 100, 1),
            "activities": round((breakdown.activity_cost / total) * 100, 1),
            "miscellaneous": round((breakdown.miscellaneous_cost / total) * 100, 1),
        }

        return BudgetCalculateResponse(
            origin=req.origin,
            destination=req.destination,
            days=req.days,
            people=req.people,
            user_budget=req.user_budget,
            requested_tier=req.budget_tier,
            breakdown=breakdown,
            tier_comparisons=tier_comparisons,
            optimization=opt_result,
            budget_allocation_percentages=allocation_pcts,
        )
    except Exception as e:
        logger.error(f"Error calculating budget: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── PART 2: Comprehensive Trip Estimate Endpoint ──

@router.post("/trip/estimate", response_model=TripEstimateResponse, tags=["Trip Intelligence"])
async def estimate_trip(req: TripEstimateRequest):
    try:
        return trip_estimator_service.estimate_trip(req)
    except Exception as e:
        logger.error(f"Error estimating trip: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Master End-to-End AI Trip Planner ──

@router.post("/plan", tags=["Master Trip Planner"])
async def plan_master_trip(payload: Dict[str, Any]):
    """
    Master End-to-End 15-step AI Trip Planning & Synthesis endpoint.
    Accepts either natural language prompts or structured payload.
    """
    try:
        return end_to_end_planner_service.plan_trip(payload)
    except Exception as e:
        logger.error(f"Error in master trip planner: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Legacy & Predictive Endpoints ──

@router.post("/predict", response_model=TripPredictionResponse, tags=["Predictions"])
async def predict_trip(req: TripPredictionRequest):
    try:
        result = prediction_service.generate_plan(req.model_dump())
        return result
    except Exception as e:
        logger.error(f"Error in predict_trip: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recommend/trip", response_model=TripPredictionResponse, tags=["Recommendations"])
async def recommend_trip(req: TripPredictionRequest):
    return await predict_trip(req)

@router.post("/predict/trip-cost", response_model=CostPredictionOutput, tags=["Specialized ML"])
async def predict_trip_cost(req: CostPredictionInput):
    try:
        return inference_engine.predict_cost(req.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict/hotel", response_model=HotelRankOutput, tags=["Specialized ML"])
async def predict_hotel_ranking(req: HotelRankInput):
    try:
        hotels_dict = [h.model_dump() for h in req.hotels]
        ranked = hotel_model.rank_hotels(
            hotels_dict,
            user_budget_per_day=req.user_budget_per_day,
            preferred_tier=req.preferred_tier,
            people=req.people
        )
        top_budget = next((h for h in ranked if h["tier"] == "budget"), None)
        top_comfort = next((h for h in ranked if h["tier"] == "comfort"), None)
        top_luxury = next((h for h in ranked if h["tier"] == "luxury"), None)

        return {
            "ranked_hotels": ranked,
            "top_budget_hotel": top_budget,
            "top_comfort_hotel": top_comfort,
            "top_luxury_hotel": top_luxury,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict/activity", response_model=ActivityRankOutput, tags=["Specialized ML"])
async def predict_activity_ranking(req: ActivityRankInput):
    try:
        acts_dict = [a.model_dump() for a in req.activities]
        ranked = activity_model.rank_activities(
            acts_dict,
            user_interests=req.user_interests,
            travel_pace=req.travel_pace
        )
        return {"ranked_activities": ranked}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── OSRM Proxy Endpoints ──

@router.post("/osrm/route", tags=["OSRM Routing"])
async def get_osrm_route(req: OSRMRouteRequest):
    try:
        return osrm_service.route(
            coordinates=req.coordinates,
            profile=req.profile,
            overview=req.overview,
            steps=req.steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/osrm/matrix", tags=["OSRM Routing"])
async def get_osrm_matrix(req: OSRMMatrixRequest):
    try:
        return osrm_service.matrix(
            origins=req.origins,
            destinations=req.destinations,
            profile=req.profile
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
