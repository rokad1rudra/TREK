import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "FastAPI" in data["framework"]

def test_transport_options_endpoint():
    payload = {
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "people": 2,
        "user_budget": 20000.0,
        "ranking_mode": "balanced"
    }
    response = client.post("/transport/options", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    types = [opt["type"] for opt in data]
    assert "train" in types
    assert "intercity_bus" in types
    assert "car" in types
    for opt in data:
        assert "data_source" in opt
        assert opt["data_source"] in ("osrm_road_engine", "estimated", "database", "historical")

def test_transport_rank_modes():
    opt_res = client.post("/transport/options", json={"origin": "Surat", "destination": "Manali", "people": 2})
    assert opt_res.status_code == 200
    options = opt_res.json()

    budget_rank = client.post("/transport/rank", json={
        "options": options,
        "user_budget": 15000.0,
        "people": 2,
        "ranking_mode": "budget",
        "distance_km": 1400.0
    })
    assert budget_rank.status_code == 200
    b_data = budget_rank.json()
    assert b_data["ranking_mode"] == "budget"
    assert b_data["active_weights"]["price"] >= 0.45
    assert len(b_data["ranked_options"]) > 0

    fastest_rank = client.post("/transport/rank", json={
        "options": options,
        "user_budget": 50000.0,
        "people": 2,
        "ranking_mode": "fastest",
        "distance_km": 1400.0
    })
    assert fastest_rank.status_code == 200
    f_data = fastest_rank.json()
    assert f_data["ranking_mode"] == "fastest"
    assert f_data["active_weights"]["duration"] >= 0.55

    custom_rank = client.post("/transport/rank", json={
        "options": options,
        "user_budget": 30000.0,
        "people": 2,
        "ranking_mode": "custom",
        "custom_weights": {"price": 0.2, "duration": 0.2, "comfort": 0.5, "availability": 0.1},
        "distance_km": 1400.0
    })
    assert custom_rank.status_code == 200
    c_data = custom_rank.json()
    assert c_data["active_weights"]["comfort"] == 0.5

def test_budget_calculate_and_tiers():
    payload = {
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "days": 4,
        "people": 2,
        "user_budget": 25000.0,
        "budget_tier": "standard",
        "selected_transport_type": "train"
    }
    response = client.post("/budget/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "breakdown" in data
    b = data["breakdown"]
    assert b["transport_cost"] > 0
    assert b["accommodation_cost"] > 0
    assert b["food_cost"] > 0
    assert b["local_transport_cost"] > 0
    assert b["activity_cost"] > 0
    assert b["miscellaneous_cost"] > 0
    assert b["total_cost"] == round(
        b["transport_cost"] + b["accommodation_cost"] + b["food_cost"] + b["local_transport_cost"] + b["activity_cost"] + b["miscellaneous_cost"],
        2
    )
    assert len(data["tier_comparisons"]) == 3

def test_budget_optimization_trigger():
    payload = {
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "days": 4,
        "people": 2,
        "user_budget": 12000.0,
        "budget_tier": "standard",
        "selected_transport_type": "train"
    }
    response = client.post("/budget/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    opt = data["optimization"]
    assert opt["is_optimized"] is True
    assert opt["money_saved"] > 0
    assert len(opt["optimization_steps_applied"]) > 0

def test_budget_feasibility_warning_on_impossible_budget():
    payload = {
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "days": 5,
        "people": 2,
        "user_budget": 1000.0,
        "budget_tier": "budget",
        "selected_transport_type": "train"
    }
    response = client.post("/budget/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    opt = data["optimization"]
    assert opt["is_budget_feasible"] is False
    assert opt["feasibility_warning"] is not None
    assert "Budget Warning" in opt["feasibility_warning"]

def test_trip_estimate_endpoint():
    payload = {
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "days": 4,
        "people": 2,
        "budget": 20000.0,
        "ranking_mode": "balanced",
        "budget_tier": "standard"
    }
    response = client.post("/trip/estimate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "distance_km" in data
    assert data["distance_km"] > 0
    assert "selected_transport" in data
    assert len(data["all_ranked_transports"]) > 0
    assert "budget_breakdown" in data
    assert "budget_optimization" in data
    assert len(data["tier_options"]) == 3

# ── PART 3 Tests ──

def test_hotel_recommendation_tiers():
    payload = {
        "destination": "Jaipur",
        "days": 4,
        "people": 2,
        "user_budget": 25000.0,
        "preferred_tier": "all"
    }
    response = client.post("/recommend/hotels", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["destination"] == "Jaipur"
    assert data["total_found"] >= 4
    assert data["scoring_method"] == "DETERMINISTIC_MULTI_CRITERIA"
    assert data["top_budget_hostel"] is not None
    assert data["top_budget_hotel"] is not None
    assert data["top_midrange_hotel"] is not None
    assert data["top_premium_hotel"] is not None
    for h in data["recommended_hotels"]:
        assert "price_per_night" in h
        assert "score" in h
        assert len(h["reasons"]) > 0
        assert h["price_per_night"] > 0

def test_activity_recommendation_and_opening_hours():
    payload = {
        "destination": "Jaipur",
        "user_interests": "history, culture, photography, food",
        "travel_pace": "balanced"
    }
    response = client.post("/recommend/activities", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["destination"] == "Jaipur"
    assert len(data["recommended_activities"]) >= 5
    assert data["scoring_method"] == "CONTENT_BASED_INTEREST_ALIGNMENT"
    for act in data["recommended_activities"]:
        assert "opening_hours" in act
        assert act["opening_hours"] != ""  # Either real verified string or "Opening hours unavailable."
        assert "price" in act
        assert "score" in act
        assert "reason" in act

def test_itinerary_generate_and_schedule_consistency():
    payload = {
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "days": 3,
        "people": 2,
        "budget": 22000.0,
        "travel_pace": "balanced",
        "user_interests": "history, culture, food"
    }
    response = client.post("/itinerary/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["days_count"] == 3
    assert len(data["days"]) == 3
    assert data["selected_hotel"] is not None
    
    # Check Day 1 schedule items
    day1 = data["days"][0]
    assert day1["day_number"] == 1
    assert len(day1["schedule"]) >= 4
    types = [item["item_type"] for item in day1["schedule"]]
    assert "hotel_checkin" in types
    assert "meal_break" in types

    # Check travel distance & times
    for day in data["days"]:
        for item in day["schedule"]:
            assert "travel_time" in item
            assert "travel_distance" in item
            assert "opening_hours" in item

def test_itinerary_optimize_endpoint():
    # 1. Generate base itinerary
    gen_res = client.post("/itinerary/generate", json={
        "origin": "Ahmedabad",
        "destination": "Jaipur",
        "days": 3,
        "people": 2,
        "budget": 20000.0
    })
    assert gen_res.status_code == 200
    base_itin = gen_res.json()

    # 2. Optimize itinerary
    opt_res = client.post("/itinerary/optimize", json={
        "itinerary": base_itin,
        "optimization_goal": "minimum_travel"
    })
    assert opt_res.status_code == 200
    opt_itin = opt_res.json()
    assert opt_itin["spatial_optimization_applied"] is True
    assert len(opt_itin["days"]) == 3

def test_end_to_end_ai_trip_planner_nlp():
    # Test natural language prompt as requested by user
    prompt_message = "I have ₹20,000 for two people. We want to travel from Ahmedabad to Jaipur for 4 days. We prefer cheap travel, hostel, train or bus, historical places and local food."
    response = client.post("/plan", json={"message": prompt_message})
    assert response.status_code == 200
    data = response.json()

    # 1. Verify trip summary
    assert "trip_summary" in data
    summary = data["trip_summary"]
    assert summary["origin"] == "Ahmedabad"
    assert summary["destination"] == "Jaipur"
    assert summary["people"] == 2
    assert summary["days"] == 4
    assert summary["user_budget"] == 20000.0
    assert summary["travel_style"] == "budget"
    assert "narrative_explanation" in summary

    # 2. Verify transport recommendations
    assert "transport" in data
    trans = data["transport"]
    assert "recommended" in trans
    assert "cheapest" in trans
    assert "fastest" in trans
    assert "balanced" in trans
    assert len(trans["alternatives"]) > 0

    # 3. Verify accommodation recommendations
    assert "accommodation" in data
    accom = data["accommodation"]
    assert "selected" in accom
    assert "best_budget_option" in accom
    assert "best_rated_option" in accom
    assert "best_location_option" in accom

    # 4. Verify activities
    assert "activities" in data
    acts = data["activities"]
    assert len(acts["top_recommendations"]) > 0
    assert len(acts["free_activities"]) > 0

    # 5. Verify day-by-day itinerary
    assert "itinerary" in data
    assert len(data["itinerary"]) == 4
    for day in data["itinerary"]:
        assert len(day["schedule"]) >= 3
        for item in day["schedule"]:
            assert "travel_time" in item
            assert "opening_hours" in item

    # 6. Verify budget & optimization
    assert "budget" in data
    assert "optimization" in data
    b = data["budget"]["breakdown"]
    assert b["transport_cost"] > 0
    assert b["total_cost"] > 0

    # 7. Verify explicit data provenance
    assert "data_sources" in data
    sources = data["data_sources"]
    assert "OSRM" in sources["road_routing"]
    assert "Verified" in sources["activity_opening_hours"]

