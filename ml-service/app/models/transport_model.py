"""
Transport Ranking ML Model & Multi-Criteria Intelligence
Ranks multimodal options (train, bus, flight, car, bike, metro, auto, walking) with configurable weight modes.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from app.schemas.trip_schemas import (
    TransportOption,
    RankedTransportResult,
    RankingMode,
    RankingWeights,
    TransportCategory,
)

WEIGHT_PRESETS: Dict[RankingMode, RankingWeights] = {
    "budget": RankingWeights(price=0.50, duration=0.20, comfort=0.10, availability=0.20),
    "fastest": RankingWeights(price=0.10, duration=0.60, comfort=0.10, availability=0.20),
    "balanced": RankingWeights(price=0.35, duration=0.30, comfort=0.15, availability=0.20),
    "comfort": RankingWeights(price=0.15, duration=0.25, comfort=0.45, availability=0.15),
    "custom": RankingWeights(price=0.35, duration=0.30, comfort=0.15, availability=0.20),
}

class TransportRankingModel:
    def rank_candidates(
        self,
        candidates: List[TransportOption],
        user_budget_per_person: float,
        people: int = 2,
        ranking_mode: RankingMode = "balanced",
        custom_weights: Optional[RankingWeights] = None,
        distance_km: float = 400.0,
    ) -> List[RankedTransportResult]:
        """
        Ranks candidate transport options using configurable multi-criteria weights and feature scoring.
        """
        if not candidates:
            return []

        # Resolve active weights
        if ranking_mode == "custom" and custom_weights is not None:
            weights = custom_weights.normalized()
        else:
            weights = WEIGHT_PRESETS.get(ranking_mode, WEIGHT_PRESETS["balanced"]).normalized()

        prices = [max(1.0, c.price_per_person) for c in candidates]
        durations = [max(0.1, c.duration_hours) for c in candidates]
        comforts = [float(c.comfort_rating) for c in candidates]
        availabilities = [float(c.availability_score) for c in candidates]

        min_p, max_p = min(prices), max(prices)
        min_d, max_d = min(durations), max(durations)

        results: List[RankedTransportResult] = []

        for opt in candidates:
            price = max(1.0, opt.price_per_person)
            duration = max(0.1, opt.duration_hours)
            comfort = float(opt.comfort_rating)
            availability = float(opt.availability_score)

            # 1. Normalized Price Score (0 - 100)
            if max_p == min_p:
                price_score = 90.0
            else:
                price_score = ((max_p - price) / (max_p - min_p)) * 80.0 + 20.0
            # Affordability bonus if strictly within user per-person budget
            if user_budget_per_person > 0 and price <= user_budget_per_person * 0.35:
                price_score = min(100.0, price_score * 1.1)

            # 2. Normalized Duration / Speed Score (0 - 100)
            if max_d == min_d:
                duration_score = 90.0
            else:
                duration_score = ((max_d - duration) / (max_d - min_d)) * 80.0 + 20.0

            # 3. Comfort Score (0 - 100)
            comfort_score = (comfort / 5.0) * 100.0

            # 4. Availability Score (0 - 100)
            avail_score = availability * 100.0

            # Composite Multi-Factor Score
            total_score = (
                weights.price * price_score
                + weights.duration * duration_score
                + weights.comfort * comfort_score
                + weights.availability * avail_score
            )
            total_score = round(min(100.0, max(5.0, total_score)), 1)

            # Assign Contextual Badge
            badge = self._assign_badge(opt.type, price_score, duration_score, comfort_score, ranking_mode)

            results.append(
                RankedTransportResult(
                    option=opt,
                    transport_score=total_score,
                    rank=0,  # assigned after sorting
                    score_breakdown={
                        "price_score": round(price_score, 1),
                        "duration_score": round(duration_score, 1),
                        "comfort_score": round(comfort_score, 1),
                        "availability_score": round(avail_score, 1),
                    },
                    recommendation_badge=badge,
                )
            )

        # Sort descending by score
        results.sort(key=lambda x: x.transport_score, reverse=True)

        # Set final rank index
        for idx, res in enumerate(results):
            res.rank = idx + 1

        return results

    def _assign_badge(
        self,
        t_type: TransportCategory,
        price_score: float,
        duration_score: float,
        comfort_score: float,
        mode: RankingMode,
    ) -> str:
        if t_type == "train":
            return "🚆 Best Overall Value & Comfort"
        elif t_type == "flight":
            return "✈️ Express / Fastest Transit"
        elif t_type in ("intercity_bus", "bus"):
            return "🚌 Budget Champion"
        elif t_type in ("car", "taxi", "cab"):
            return "🚗 Maximum Flexibility & Door-to-Door"
        elif t_type == "bike":
            return "🏍️ Scenic Adventure Road Ride"
        elif t_type == "metro":
            return "🚇 Zero Traffic Urban Corridor"
        elif t_type == "auto_rickshaw":
            return "🛺 Quick Local Connector"
        elif t_type == "walking":
            return "🚶 Eco-Friendly Heritage Stroll"
        return "✨ Recommended Option"

    def rank_options(
        self,
        options: List[Dict[str, Any]],
        user_budget_per_person: float,
        distance_km: float,
        people: int,
    ) -> List[Dict[str, Any]]:
        scored_options = []
        for opt in options:
            price = max(1.0, float(opt.get("price_per_person", 1000.0)))
            duration = max(0.5, float(opt.get("duration_hours", 4.0)))
            comfort = float(opt.get("comfort_rating", 4.0))
            m_type = opt.get("type", "train").lower()

            affordability_ratio = price / max(100.0, user_budget_per_person)
            affordability_score = max(0.0, min(40.0, (1.0 - affordability_ratio) * 40.0 + 10.0))
            speed_kmh = distance_km / duration
            speed_score = min(35.0, (speed_kmh / 120.0) * 35.0)
            comfort_score = (comfort / 5.0) * 25.0
            final_score = round(min(100.0, max(10.0, affordability_score + speed_score + comfort_score)), 1)

            if m_type == "train":
                tag = "Budget Champion"
                tag_color = "emerald"
            elif m_type == "flight":
                tag = "Fastest Route"
                tag_color = "sky"
            elif m_type in ("road_trip", "car"):
                tag = "Scenic Road Trip"
                tag_color = "amber"
            else:
                tag = "Direct Transit"
                tag_color = "purple"

            total_cost_group = round(price * max(1, people), 2)
            duration_formatted = f"{int(duration)}h {int((duration % 1) * 60)}m" if duration >= 1 else f"{int(duration * 60)} mins"

            scored_options.append({
                "id": opt.get("id", m_type),
                "title": opt.get("title", f"{m_type.capitalize()} Journey"),
                "type": m_type,
                "score": final_score,
                "tag": tag,
                "tag_color": tag_color,
                "price_per_person": price,
                "total_cost_for_group": total_cost_group,
                "duration_hours": duration,
                "duration_formatted": duration_formatted,
                "description": opt.get("description", f"Travel via {m_type} with optimal route efficiency.")
            })

        scored_options.sort(key=lambda x: x["score"], reverse=True)
        for idx, item in enumerate(scored_options):
            item["rank"] = idx + 1
        return scored_options

transport_rank_model = TransportRankingModel()
transport_model = transport_rank_model

