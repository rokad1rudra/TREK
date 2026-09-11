"""
Budget Optimization Engine
Executes systematic 5-step cost reduction when total cost exceeds user budget, and issues feasibility warnings.
"""

from typing import List, Dict, Any, Optional
from app.schemas.trip_schemas import (
    ItemizedBudgetBreakdown,
    BudgetOptimizationResult,
    BudgetOptimizationStep,
    BudgetTier,
)
from app.services.budget_service import budget_intelligence_service

class BudgetOptimizationEngine:
    def optimize(
        self,
        original_breakdown: ItemizedBudgetBreakdown,
        user_budget: float,
        distance_km: float,
        days: int,
        people: int,
        initial_tier: BudgetTier = "standard",
    ) -> BudgetOptimizationResult:
        """
        Attempts multi-stage optimization to fit the trip within the user's budget.
        """
        orig_total = original_breakdown.total_cost

        # Case 1: Trip already comfortably within budget
        if orig_total <= user_budget:
            return BudgetOptimizationResult(
                original_cost=orig_total,
                optimized_cost=orig_total,
                money_saved=0.0,
                remaining_budget=round(user_budget - orig_total, 2),
                is_budget_feasible=True,
                is_optimized=False,
                feasibility_warning=None,
                optimization_steps_applied=[],
                recommended_tier=initial_tier,
            )

        # Case 2: Trip exceeds budget -> Apply 5-stage optimization
        steps: List[BudgetOptimizationStep] = []
        current_stay = original_breakdown.accommodation_cost
        current_trans = original_breakdown.transport_cost
        current_food = original_breakdown.food_cost
        current_local = original_breakdown.local_transport_cost
        current_act = original_breakdown.activity_cost

        step_num = 1

        # ── Step 1: Transport Optimization ──
        # Switch from Flight/Taxi to 3AC/Sleeper Train or Central Bus
        budget_trans_breakdown = budget_intelligence_service.calculate_itemized_budget(
            distance_km=distance_km,
            days=days,
            people=people,
            tier="budget",
            selected_transport_type="train",
        )
        min_transport = budget_trans_breakdown.transport_cost
        if current_trans > min_transport:
            saved_trans = round(current_trans - min_transport, 2)
            current_trans = min_transport
            steps.append(
                BudgetOptimizationStep(
                    step_number=step_num,
                    category="Intercity Transport",
                    action="Switch to IRCTC 3AC / Sleeper Train or Volvo Coach",
                    savings_amount=saved_trans,
                    description=f"Reduced intercity transit expense by utilizing superfast rail/bus instead of premium modes.",
                )
            )
            step_num += 1

        # ── Step 2: Accommodation Optimization ──
        # Switch from luxury/standard hotel to verified Zostel/Homestay
        min_stay = budget_trans_breakdown.accommodation_cost
        if current_stay > min_stay:
            saved_stay = round(current_stay - min_stay, 2)
            current_stay = min_stay
            steps.append(
                BudgetOptimizationStep(
                    step_number=step_num,
                    category="Accommodation",
                    action="Select Verified Homestay / Central Zostel Room",
                    savings_amount=saved_stay,
                    description=f"Switched stay to highly-rated budget residency (₹1,200/room/night).",
                )
            )
            step_num += 1

        # ── Step 3: Activity Rationalization ──
        min_act = budget_trans_breakdown.activity_cost
        if current_act > min_act:
            saved_act = round(current_act - min_act, 2)
            current_act = min_act
            steps.append(
                BudgetOptimizationStep(
                    step_number=step_num,
                    category="Activities & Sightseeing",
                    action="Prioritize Free Heritage Walks, Viewpoints & Public Monuments",
                    savings_amount=saved_act,
                    description="Replaced expensive private guided tours with self-guided heritage trails.",
                )
            )
            step_num += 1

        # ── Step 4: Local Transit Efficiency ──
        min_local = budget_trans_breakdown.local_transport_cost
        if current_local > min_local:
            saved_local = round(current_local - min_local, 2)
            current_local = min_local
            steps.append(
                BudgetOptimizationStep(
                    step_number=step_num,
                    category="Local Commute",
                    action="Use City Metro, Shared Autos & E-Rickshaws",
                    savings_amount=saved_local,
                    description="Utilize shared urban connectors instead of hiring full-day private cabs.",
                )
            )
            step_num += 1

        # ── Step 5: Food & Dining Optimization ──
        min_food = budget_trans_breakdown.food_cost
        if current_food > min_food:
            saved_food = round(current_food - min_food, 2)
            current_food = min_food
            steps.append(
                BudgetOptimizationStep(
                    step_number=step_num,
                    category="Food & Dining",
                    action="Authentic Regional Thalis & Popular Local Eateries",
                    savings_amount=saved_food,
                    description="Enjoy authentic regional cuisine at top-rated local food joints instead of luxury hotel restaurants.",
                )
            )
            step_num += 1

        subtotal_opt = current_trans + current_stay + current_food + current_local + current_act
        misc_opt = round(subtotal_opt * 0.05, 2)
        final_optimized_cost = round(subtotal_opt + misc_opt, 2)
        total_money_saved = round(orig_total - final_optimized_cost, 2)

        # Feasibility check: Can it fit within user_budget?
        if final_optimized_cost <= user_budget:
            return BudgetOptimizationResult(
                original_cost=orig_total,
                optimized_cost=final_optimized_cost,
                money_saved=total_money_saved,
                remaining_budget=round(user_budget - final_optimized_cost, 2),
                is_budget_feasible=True,
                is_optimized=True,
                feasibility_warning=None,
                optimization_steps_applied=steps,
                recommended_tier="budget",
            )
        else:
            # Budget is physically insufficient even in ultra-budget mode
            deficit = round(final_optimized_cost - user_budget, 2)
            warning_msg = (
                f"⚠️ Budget Warning: A {days}-day trip for {people} travelers covering ~{distance_km} km "
                f"has a minimum realistic cost of ₹{final_optimized_cost:,.2f}. "
                f"Your entered budget (₹{user_budget:,.2f}) is short by ₹{deficit:,.2f}. "
                f"We recommend increasing your budget to at least ₹{final_optimized_cost:,.2f} or reducing trip duration to {max(1, int(days * (user_budget / final_optimized_cost)))} days."
            )
            return BudgetOptimizationResult(
                original_cost=orig_total,
                optimized_cost=final_optimized_cost,
                money_saved=total_money_saved,
                remaining_budget=0.0,
                is_budget_feasible=False,
                is_optimized=True,
                feasibility_warning=warning_msg,
                optimization_steps_applied=steps,
                recommended_tier="budget",
            )

budget_optimizer = BudgetOptimizationEngine()
