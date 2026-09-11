"""
Budget Calculation & Multi-Tier Intelligence Engine
Calculates itemized breakdowns across Budget, Standard, Premium, and Custom tiers.
"""

from typing import Dict, Any, List, Optional
from app.schemas.trip_schemas import (
    ItemizedBudgetBreakdown,
    TierBudgetComparison,
    BudgetTier,
    TransportCategory,
)

# Daily baseline rates per person across tiers (in INR)
TIER_RATES = {
    "budget": {
        "stay_per_room_night": 1200.0,
        "food_per_person_day": 450.0,
        "local_transport_per_person_day": 200.0,
        "activity_per_person_day": 250.0,
        "misc_percent": 0.05,
    },
    "standard": {
        "stay_per_room_night": 3200.0,
        "food_per_person_day": 900.0,
        "local_transport_per_person_day": 450.0,
        "activity_per_person_day": 500.0,
        "misc_percent": 0.07,
    },
    "premium": {
        "stay_per_room_night": 7500.0,
        "food_per_person_day": 2200.0,
        "local_transport_per_person_day": 1200.0,
        "activity_per_person_day": 1200.0,
        "misc_percent": 0.10,
    },
}

# Baseline transport unit cost per person per km
TRANSPORT_UNIT_RATES = {
    "train": 1.15,
    "bus": 1.45,
    "intercity_bus": 1.45,
    "central_bus": 0.95,
    "flight": 4.40,
    "taxi": 3.80,
    "cab": 3.80,
    "car": 2.20,
    "bike": 1.60,
    "metro": 0.60,
    "auto_rickshaw": 1.80,
    "walking": 0.0,
    "other": 1.50,
}

class BudgetIntelligenceService:
    def calculate_itemized_budget(
        self,
        distance_km: float,
        days: int,
        people: int,
        tier: BudgetTier = "standard",
        selected_transport_type: TransportCategory = "train",
        custom_transport_cost_pp: Optional[float] = None,
        custom_total_budget: Optional[float] = None,
    ) -> ItemizedBudgetBreakdown:
        """
        Calculates itemized budget breakdown.
        """
        people = max(1, people)
        days = max(1, days)
        nights = max(1, days - 1)
        effective_tier = "standard" if tier not in TIER_RATES else tier

        if tier == "custom" and custom_total_budget and custom_total_budget > 0:
            # Proportionally allocate custom budget
            total = custom_total_budget
            transport_cost = round(total * 0.28, 2)
            accommodation_cost = round(total * 0.32, 2)
            food_cost = round(total * 0.22, 2)
            local_transport_cost = round(total * 0.08, 2)
            activity_cost = round(total * 0.06, 2)
            misc_cost = round(total * 0.04, 2)
            
            return ItemizedBudgetBreakdown(
                transport_cost=transport_cost,
                accommodation_cost=accommodation_cost,
                food_cost=food_cost,
                local_transport_cost=local_transport_cost,
                activity_cost=activity_cost,
                miscellaneous_cost=misc_cost,
                total_cost=round(total, 2),
                cost_per_person=round(total / people, 2),
                daily_cost=round(total / (days * people), 2),
            )

        rates = TIER_RATES[effective_tier]

        # 1. Intercity Transport Cost
        if custom_transport_cost_pp is not None and custom_transport_cost_pp > 0:
            trans_pp = custom_transport_cost_pp
        else:
            unit = TRANSPORT_UNIT_RATES.get(selected_transport_type, 1.2)
            trans_pp = max(350.0, round(distance_km * unit, 2))
        # Multiply by 2 for round-trip intercity
        total_transport = round(trans_pp * 2.0 * people, 2)

        # 2. Accommodation Cost
        # In budget tier: 3 people/room or hostel beds. In standard/premium: 2 people/room.
        rooms = max(1, (people + 1) // 2) if effective_tier != "budget" else max(1, (people + 2) // 3)
        total_stay = round(rooms * nights * rates["stay_per_room_night"], 2)

        # 3. Food Cost
        total_food = round(people * days * rates["food_per_person_day"], 2)

        # 4. Local Transport Cost
        total_local = round(people * days * rates["local_transport_per_person_day"], 2)

        # 5. Activity Cost
        total_activity = round(people * days * rates["activity_per_person_day"], 2)

        # 6. Miscellaneous / Contingency Buffer
        subtotal = total_transport + total_stay + total_food + total_local + total_activity
        total_misc = round(subtotal * rates["misc_percent"], 2)
        total_cost = round(subtotal + total_misc, 2)

        return ItemizedBudgetBreakdown(
            transport_cost=total_transport,
            accommodation_cost=total_stay,
            food_cost=total_food,
            local_transport_cost=total_local,
            activity_cost=total_activity,
            miscellaneous_cost=total_misc,
            total_cost=total_cost,
            cost_per_person=round(total_cost / people, 2),
            daily_cost=round(total_cost / (days * people), 2),
        )

    def generate_tier_comparisons(
        self,
        distance_km: float,
        days: int,
        people: int,
    ) -> List[TierBudgetComparison]:
        """Generates cost comparison across Budget, Standard, and Premium tiers."""
        comparisons = []
        tier_configs = [
            ("budget", "train", "Zostels / Homestays, Sleeper/3AC Rail & Regional Cuisine"),
            ("standard", "train", "3-Star Boutique Hotels, Superfast Rail & Cab/Metro"),
            ("premium", "flight" if distance_km >= 250 else "taxi", "4/5-Star Resorts, Domestic Flights / Private SUV & Fine Dining"),
        ]

        for t_name, def_mode, desc in tier_configs:
            breakdown = self.calculate_itemized_budget(
                distance_km=distance_km,
                days=days,
                people=people,
                tier=t_name,  # type: ignore
                selected_transport_type=def_mode,  # type: ignore
            )
            comparisons.append(
                TierBudgetComparison(
                    tier=t_name,  # type: ignore
                    total_cost=breakdown.total_cost,
                    cost_per_person=breakdown.cost_per_person,
                    daily_cost=breakdown.daily_cost,
                    description=desc,
                )
            )

        return comparisons

budget_intelligence_service = BudgetIntelligenceService()
