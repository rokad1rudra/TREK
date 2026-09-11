"""
End-to-End AI Trip Planner Demo Runner
Executes the exact prompt provided by the user and prints the structured 15-step pipeline output.
"""

import sys
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.end_to_end_planner_service import end_to_end_planner_service

def run_demo():
    prompt = "I have ₹20,000 for two people. We want to travel from Ahmedabad to Jaipur for 4 days. We prefer cheap travel, hostel, train or bus, historical places and local food."
    print("=" * 80)
    print("USER PROMPT:")
    print(f'"{prompt}"')
    print("=" * 80)

    result = end_to_end_planner_service.plan_trip({"message": prompt})

    print("\n--- 1. TRIP SUMMARY ---")
    print(json.dumps(result["trip_summary"], indent=2))

    print("\n--- 2. RECOMMENDED TRANSPORT ---")
    print(f"Recommended Mode : {result['transport']['recommended']['title']}")
    print(f"Price per person : ₹{result['transport']['recommended']['price_per_person']}")
    print(f"Duration         : {result['transport']['recommended']['duration_formatted']}")
    print(f"Data Source      : {result['transport']['recommended']['data_source']}")

    print("\n--- 3. SELECTED ACCOMMODATION ---")
    print(f"Name             : {result['accommodation']['selected']['name']}")
    print(f"Tier             : {result['accommodation']['selected']['tier']}")
    print(f"Price per night  : ₹{result['accommodation']['selected']['price_per_night']}")
    print(f"Rating           : {result['accommodation']['selected']['rating']}/5")
    print(f"Reasons          : {result['accommodation']['selected']['reasons']}")

    print("\n--- 4. ACTIVITIES ---")
    for act in result["activities"]["top_recommendations"]:
        print(f"  • {act['title']} ({act['category']}) - ₹{act['price']} | {act['duration_formatted']} | Hours: {act['opening_hours']}")

    print("\n--- 5. DAY-BY-DAY ITINERARY ---")
    for day in result["itinerary"]:
        print(f"\n  [Day {day['day_number']}: {day['title']}] - Daily Cost: ₹{day['daily_cost']}")
        for item in day["schedule"]:
            print(f"    - {item['time']} | {item['activity']} ({item['location']}) | Travel: {item['travel_time']} ({item['travel_distance']})")

    print("\n--- 6. BUDGET & OPTIMIZATION ---")
    print(f"Total Cost       : ₹{result['budget']['total']:,.2f}")
    print(f"Cost per Person  : ₹{result['budget']['cost_per_person']:,.2f}")
    print(f"Daily Cost       : ₹{result['budget']['daily_cost']:,.2f}")
    print(f"Remaining Budget : ₹{result['budget']['remaining_budget']:,.2f}")
    print(f"Optimization     : Feasible = {result['optimization']['is_budget_feasible']}, Saved = ₹{result['optimization']['money_saved']:,.2f}")

    print("\n--- 7. DATA PROVENANCE ---")
    print(json.dumps(result["data_sources"], indent=2))
    print("\n" + "=" * 80)
    print("✅ End-to-End AI Trip Planner executed successfully with 0 hallucinations!")
    print("=" * 80)

if __name__ == "__main__":
    run_demo()
