"""
Comprehensive Trip, Transport, Hotel, Activity & Itinerary Schemas for ML Microservice
Pydantic v2 validation models for Part 1, Part 2, and Part 3.
"""

from typing import List, Optional, Dict, Any, Tuple, Literal
from pydantic import BaseModel, Field

# ── Data Provenance & Enums ──
DataSourceType = Literal["real_time", "database", "estimated", "historical", "osrm_road_engine"]
RankingMode = Literal["budget", "fastest", "balanced", "comfort", "custom"]
BudgetTier = Literal["budget", "standard", "premium", "custom"]
HotelTier = Literal["budget_hostel", "budget_hotel", "midrange_hotel", "premium_hotel"]
ActivityCategory = Literal[
    "history",
    "nature",
    "adventure",
    "beach",
    "mountains",
    "food",
    "shopping",
    "nightlife",
    "photography",
    "culture",
    "family",
    "backpacking",
    "religious_places",
    "local_experiences",
    "other"
]
TransportCategory = Literal[
    "train",
    "bus",
    "intercity_bus",
    "central_bus",
    "flight",
    "taxi",
    "cab",
    "car",
    "bike",
    "metro",
    "auto_rickshaw",
    "walking",
    "other"
]

# ── Configurable Ranking Weights ──
class RankingWeights(BaseModel):
    price: float = Field(default=0.35, ge=0.0, le=1.0)
    duration: float = Field(default=0.30, ge=0.0, le=1.0)
    comfort: float = Field(default=0.15, ge=0.0, le=1.0)
    availability: float = Field(default=0.20, ge=0.0, le=1.0)

    def normalized(self) -> "RankingWeights":
        total = self.price + self.duration + self.comfort + self.availability
        if total <= 0:
            return RankingWeights(price=0.35, duration=0.30, comfort=0.15, availability=0.20)
        return RankingWeights(
            price=round(self.price / total, 4),
            duration=round(self.duration / total, 4),
            comfort=round(self.comfort / total, 4),
            availability=round(self.availability / total, 4),
        )

# ── PART 1 Core Legacy Schemas ──

class TripPredictionRequest(BaseModel):
    origin: str = Field(..., description="Starting city or landmark")
    destination: str = Field(..., description="Destination city or landmark")
    people: int = Field(default=2, ge=1, le=50)
    days: int = Field(default=4, ge=1, le=60)
    budget: float = Field(default=20000.0, ge=500.0)
    travel_pace: str = Field(default="balanced")
    interests: Optional[str] = Field(default="Sightseeing, Local Cuisine, Culture, Photography")
    transit_mode: Optional[str] = Field(default="train_bus")
    budget_tier: Optional[str] = Field(default="budget")
    season: Optional[str] = Field(default="winter")
    start_date: Optional[str] = None
    origin_coords: Optional[Tuple[float, float]] = None
    dest_coords: Optional[Tuple[float, float]] = None

class CostPredictionInput(BaseModel):
    origin: str
    destination: str
    distance_km: float
    duration_hours: float
    people: int = 2
    days: int = 4
    transport_type: str = "train"
    hotel_category: str = "budget"
    season: str = "winter"

class CostPredictionOutput(BaseModel):
    estimated_total_cost: float
    cost_per_person: float
    cost_per_day: float
    breakdown: Dict[str, float] = Field(
        default_factory=lambda: {"stay": 0.0, "food": 0.0, "travel": 0.0, "activities": 0.0, "buffer": 0.0}
    )

class TransportOptionInput(BaseModel):
    id: str
    type: str
    title: str
    price_per_person: float
    duration_hours: float
    comfort_rating: float = 4.0
    availability_score: float = 0.9

class TransportRankInput(BaseModel):
    distance_km: float = 400.0
    user_budget: float = 20000.0
    people: int = 2
    options: List[TransportOptionInput] = []

class RankedTransportOption(BaseModel):
    id: str
    title: str
    type: str
    score: float
    rank: int
    tag: str
    tag_color: str
    price_per_person: float
    total_cost_for_group: float
    duration_formatted: str
    duration_hours: float
    description: str

class TransportRankOutput(BaseModel):
    ranked_options: List[RankedTransportOption]
    recommended_option_id: str

class HotelCandidateInput(BaseModel):
    id: str
    name: str
    tier: str
    price_per_night: float
    rating: float
    review_count: int
    distance_to_center_km: float = 2.0
    amenities: List[str] = []
    area: str = ""

class HotelRankInput(BaseModel):
    user_budget_per_day: float
    preferred_tier: str
    people: int
    hotels: List[HotelCandidateInput]

class RankedHotel(BaseModel):
    id: str
    name: str
    tier: str
    score: float
    rank: int
    price_per_night: float
    per_person_price: float
    rating: float
    review_count: int
    amenities: List[str]
    area: str
    booking_url: str
    google_hotels_url: str

class HotelRankOutput(BaseModel):
    ranked_hotels: List[RankedHotel]
    top_budget_hotel: Optional[RankedHotel] = None
    top_comfort_hotel: Optional[RankedHotel] = None
    top_luxury_hotel: Optional[RankedHotel] = None

class ActivityCandidateInput(BaseModel):
    id: str
    title: str
    category: str
    est_cost: float
    duration_hours: float
    rating: float
    description: str = ""

class ActivityRankInput(BaseModel):
    user_interests: str
    travel_pace: str
    activities: List[ActivityCandidateInput]

class RankedActivity(BaseModel):
    id: str
    title: str
    category: str
    score: float
    rank: int
    est_cost: float
    duration: str
    rating: float
    description: str

class ActivityRankOutput(BaseModel):
    ranked_activities: List[RankedActivity]

class ItinerarySpotOutput(BaseModel):
    name: str
    time: str
    period: str
    description: str
    lat: float
    lng: float
    cost_est: float
    category: str
    transit_from_prev: Optional[str] = None

class ItineraryDayOutput(BaseModel):
    day_number: int
    title: str
    theme: str
    spots: List[ItinerarySpotOutput]
    daily_cost: float
    pro_tip: str

class TripPredictionResponse(BaseModel):
    trip_title: str
    origin: str
    destination: str
    zone: str
    people: int
    days_count: int
    total_distance_km: float
    driving_hours: float
    recommended_mode: str
    estimated_total_cost: float
    cost_per_person: float
    cost_breakdown: Dict[str, float]
    ranked_transports: List[RankedTransportOption]
    recommended_hotels: List[RankedHotel]
    recommended_activities: List[RankedActivity]
    itinerary_days: List[ItineraryDayOutput]
    highlights: List[str]
    model_version: str = "2.0.0-ml-scikit"

# ── PART 2 Transport Intelligence Schemas ──

class TransportOption(BaseModel):
    id: str
    type: TransportCategory
    title: str
    operator_or_service: str = "Standard Service"
    class_or_tier: str = "Standard"
    price_per_person: float
    total_cost_for_group: float
    duration_hours: float
    duration_formatted: str
    distance_km: float
    comfort_rating: float = Field(default=4.0, ge=1.0, le=5.0)
    availability_score: float = Field(default=0.9, ge=0.0, le=1.0)
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    data_source: DataSourceType = "estimated"
    route_geometry: Optional[Dict[str, Any]] = None
    co2_emissions_kg: float = 0.0
    description: str = ""
    suitability_tag: str = "Recommended"
    suitability_color: str = "emerald"

class TransportOptionsRequest(BaseModel):
    origin: str
    destination: str
    distance_km: Optional[float] = None
    driving_hours: Optional[float] = None
    people: int = Field(default=2, ge=1, le=50)
    user_budget: Optional[float] = None
    ranking_mode: RankingMode = "balanced"
    custom_weights: Optional[RankingWeights] = None
    origin_coords: Optional[Tuple[float, float]] = None
    dest_coords: Optional[Tuple[float, float]] = None

class TransportRankRequest(BaseModel):
    options: List[TransportOption]
    user_budget: float
    people: int = 2
    ranking_mode: RankingMode = "balanced"
    custom_weights: Optional[RankingWeights] = None
    distance_km: float = 400.0

class RankedTransportResult(BaseModel):
    option: TransportOption
    transport_score: float
    rank: int
    score_breakdown: Dict[str, float]
    recommendation_badge: str

class TransportRankResponse(BaseModel):
    ranking_mode: RankingMode
    active_weights: RankingWeights
    ranked_options: List[RankedTransportResult]
    top_recommended_id: str
    fastest_option_id: str
    cheapest_option_id: str
    most_comfortable_id: str

# ── PART 2 Budget Schemas ──

class BudgetCalculateRequest(BaseModel):
    origin: str
    destination: str
    days: int = Field(default=4, ge=1, le=60)
    people: int = Field(default=2, ge=1, le=50)
    user_budget: float = Field(default=20000.0, ge=500.0)
    budget_tier: BudgetTier = "standard"
    selected_transport_type: TransportCategory = "train"
    selected_transport_cost_per_person: Optional[float] = None
    travel_pace: str = "balanced"
    season: str = "winter"

class ItemizedBudgetBreakdown(BaseModel):
    transport_cost: float
    accommodation_cost: float
    food_cost: float
    local_transport_cost: float
    activity_cost: float
    miscellaneous_cost: float
    total_cost: float
    cost_per_person: float
    daily_cost: float

class TierBudgetComparison(BaseModel):
    tier: BudgetTier
    total_cost: float
    cost_per_person: float
    daily_cost: float
    description: str

class BudgetOptimizationStep(BaseModel):
    step_number: int
    category: str
    action: str
    savings_amount: float
    description: str

class BudgetOptimizationResult(BaseModel):
    original_cost: float
    optimized_cost: float
    money_saved: float
    remaining_budget: float
    is_budget_feasible: bool
    is_optimized: bool
    feasibility_warning: Optional[str] = None
    optimization_steps_applied: List[BudgetOptimizationStep] = []
    recommended_tier: BudgetTier = "budget"

class BudgetCalculateResponse(BaseModel):
    origin: str
    destination: str
    days: int
    people: int
    user_budget: float
    requested_tier: BudgetTier
    breakdown: ItemizedBudgetBreakdown
    tier_comparisons: List[TierBudgetComparison]
    optimization: BudgetOptimizationResult
    budget_allocation_percentages: Dict[str, float]

class TripEstimateRequest(BaseModel):
    origin: str
    destination: str
    days: int = Field(default=4, ge=1, le=60)
    people: int = Field(default=2, ge=1, le=50)
    budget: float = Field(default=20000.0, ge=500.0)
    ranking_mode: RankingMode = "balanced"
    custom_weights: Optional[RankingWeights] = None
    budget_tier: BudgetTier = "standard"
    travel_pace: str = "balanced"
    interests: str = "Sightseeing, Local Cuisine, Culture, Photography"
    season: str = "winter"
    start_date: Optional[str] = None
    origin_coords: Optional[Tuple[float, float]] = None
    dest_coords: Optional[Tuple[float, float]] = None

class TripEstimateResponse(BaseModel):
    trip_title: str
    origin: str
    destination: str
    distance_km: float
    driving_duration_hours: float
    road_data_source: DataSourceType = "osrm_road_engine"
    travelers_count: int
    days_count: int
    user_budget: float
    selected_transport: TransportOption
    all_ranked_transports: List[RankedTransportResult]
    budget_breakdown: ItemizedBudgetBreakdown
    budget_optimization: BudgetOptimizationResult
    tier_options: List[TierBudgetComparison]
    itinerary_highlights: List[str]
    model_version: str = "2.0.0-ml-transport-budget"

# ── PART 3 Hotel & Hostel Schemas ──

class HotelRecommendationRequest(BaseModel):
    destination: str
    days: int = Field(default=4, ge=1, le=60)
    people: int = Field(default=2, ge=1, le=50)
    user_budget: Optional[float] = None
    preferred_tier: Optional[str] = Field(default="all", description="budget_hostel | budget_hotel | midrange_hotel | premium_hotel | all")
    user_preferences: Optional[str] = None
    dest_coords: Optional[Tuple[float, float]] = None

class RecommendedHotelItem(BaseModel):
    id: str
    name: str
    tier: HotelTier
    price_per_night: float
    per_person_price: float
    rating: float
    review_count: int
    distance_to_center_km: float
    location_area: str
    amenities: List[str]
    score: float
    reasons: List[str]
    booking_url: str
    google_hotels_url: str
    lat: float
    lng: float
    data_source: DataSourceType = "database"

class HotelRecommendationResponse(BaseModel):
    destination: str
    total_found: int
    recommended_hotels: List[RecommendedHotelItem]
    top_budget_hostel: Optional[RecommendedHotelItem] = None
    top_budget_hotel: Optional[RecommendedHotelItem] = None
    top_midrange_hotel: Optional[RecommendedHotelItem] = None
    top_premium_hotel: Optional[RecommendedHotelItem] = None
    scoring_method: str = "DETERMINISTIC_MULTI_CRITERIA"

# ── PART 3 Activity Schemas ──

class ActivityRecommendationRequest(BaseModel):
    destination: str
    user_interests: Optional[str] = "history, culture, food, photography"
    travel_pace: Optional[str] = "balanced"
    categories: Optional[List[str]] = None
    max_price: Optional[float] = None
    dest_coords: Optional[Tuple[float, float]] = None

class RecommendedActivityItem(BaseModel):
    id: str
    title: str
    category: str
    price: float
    duration_hours: float
    duration_formatted: str
    rating: float
    distance_from_center_km: float
    score: float
    reason: str
    opening_hours: str  # Real verified string OR "Opening hours unavailable."
    description: str
    lat: float
    lng: float
    is_free: bool
    best_time_to_visit: str
    data_source: DataSourceType = "database"

class ActivityRecommendationResponse(BaseModel):
    destination: str
    user_interests_matched: List[str]
    total_found: int
    recommended_activities: List[RecommendedActivityItem]
    scoring_method: str = "CONTENT_BASED_INTEREST_ALIGNMENT"

# ── PART 3 Day-by-Day Itinerary Engine & Optimization Schemas ──

class ItineraryScheduleItem(BaseModel):
    item_type: Literal["activity", "meal_break", "hotel_checkin", "hotel_checkout", "hotel_rest", "transit"]
    time: str
    location: str
    activity: str
    duration: str
    duration_hours: float
    travel_time: str
    travel_distance: str
    travel_distance_km: float
    estimated_cost: float
    meal_break: Optional[str] = None
    opening_hours: str
    notes: str
    lat: float
    lng: float
    osrm_route_geometry: Optional[Dict[str, Any]] = None

class ItineraryDayPlan(BaseModel):
    day_number: int
    title: str
    theme: str
    schedule: List[ItineraryScheduleItem]
    daily_cost: float
    daily_travel_distance_km: float
    daily_travel_duration_hours: float
    day_notes: str

class ItineraryGenerateRequest(BaseModel):
    origin: str
    destination: str
    days: int = Field(default=4, ge=1, le=60)
    people: int = Field(default=2, ge=1, le=50)
    budget: float = Field(default=20000.0, ge=500.0)
    travel_pace: str = "balanced"
    user_interests: str = "history, culture, food, photography"
    selected_hotel_id: Optional[str] = None
    budget_tier: str = "standard"
    origin_coords: Optional[Tuple[float, float]] = None
    dest_coords: Optional[Tuple[float, float]] = None

class ItineraryGenerateResponse(BaseModel):
    trip_title: str
    origin: str
    destination: str
    days_count: int
    people_count: int
    selected_hotel: RecommendedHotelItem
    days: List[ItineraryDayPlan]
    total_trip_cost: float
    total_travel_distance_km: float
    spatial_optimization_applied: bool
    warnings: List[str]

class ItineraryOptimizeRequest(BaseModel):
    itinerary: ItineraryGenerateResponse
    optimization_goal: Literal["minimum_travel", "budget_reduction", "experience_density"] = "minimum_travel"
