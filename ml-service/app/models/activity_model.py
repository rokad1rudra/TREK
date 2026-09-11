"""
Activity & Attraction Ranking Model
Ranks activities and sights based on user interests, rating, category, and pace.
"""

from typing import List, Dict, Any

class ActivityRankModel:
    def rank_activities(
        self,
        activities: List[Dict[str, Any]],
        user_interests: str = "",
        travel_pace: str = "balanced"
    ) -> List[Dict[str, Any]]:
        """
        Scores and ranks tourist activities.
        """
        scored_activities = []
        interests_lower = [i.strip().lower() for i in user_interests.split(",") if i.strip()]

        for act in activities:
            title = act.get("title", "Historic Landmark")
            category = act.get("category", "Sightseeing")
            rating = max(1.0, min(5.0, float(act.get("rating", 4.5))))
            cost = float(act.get("est_cost", 100.0))
            duration_h = float(act.get("duration_hours", 2.0))

            # 1. Rating Score (0-40 pts)
            rating_score = (rating / 5.0) * 40.0

            # 2. Interest Alignment Score (0-40 pts)
            category_match = any(
                k in category.lower() or k in title.lower() or k in act.get("description", "").lower()
                for k in interests_lower
            ) if interests_lower else True
            interest_score = 40.0 if category_match else 20.0

            # 3. Pace Compatibility Score (0-20 pts)
            if travel_pace == "relaxed":
                pace_score = 20.0 if duration_h <= 2.5 else 10.0
            elif travel_pace == "explorer":
                pace_score = 20.0  # open to long activities
            else:
                pace_score = 18.0

            final_score = round(min(100.0, rating_score + interest_score + pace_score), 1)

            duration_str = f"{int(duration_h)}h {int((duration_h % 1)*60)}m" if duration_h >= 1 else f"{int(duration_h * 60)} mins"

            scored_activities.append({
                "id": act.get("id", title.lower().replace(" ", "-")),
                "title": title,
                "category": category,
                "score": final_score,
                "est_cost": cost,
                "duration": duration_str,
                "rating": rating,
                "description": act.get("description", f"Explore authentic attractions and scenery in {title}.")
            })

        # Sort descending by score
        scored_activities.sort(key=lambda x: x["score"], reverse=True)

        for idx, item in enumerate(scored_activities):
            item["rank"] = idx + 1

        return scored_activities

activity_model = ActivityRankModel()
