"""
Abstract LLM Provider Base & Deterministic NLP Fallback Parser
Ensures LLM handles only natural language understanding/explanation without hallucinating factual computations.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import re
from app.utils.logger import get_logger

logger = get_logger("llm-base")

class LLMProvider(ABC):
    """Abstract interface for pluggable LLM backends (Ollama, OpenAI-compatible, etc.)"""

    @abstractmethod
    def parse_user_intent(self, message: str) -> Dict[str, Any]:
        """Extracts structured travel parameters from natural language input."""
        pass

    @abstractmethod
    def explain_trip_plan(self, plan_data: Dict[str, Any]) -> str:
        """Generates a human-friendly narrative explaining the computed trip plan."""
        pass

class HeuristicNLPParser:
    """
    Deterministic rule-based NLP extraction engine.
    Ensures 100% reliability even if Ollama is offline or unconfigured.
    """

    def parse(self, text: str) -> Dict[str, Any]:
        t = text.lower()

        # 1. Budget extraction
        budget = 20000.0
        currency = "INR"
        budget_match = re.search(r'(?:₹|rs\.?|inr)\s*([\d,]+)|([\d,]+)\s*(?:₹|rs\.?|inr|rupees)', t)
        if budget_match:
            raw_b = budget_match.group(1) or budget_match.group(2)
            try:
                budget = float(raw_b.replace(",", ""))
            except ValueError:
                budget = 20000.0
        else:
            k_match = re.search(r'(\d+)\s*k\b', t)
            if k_match:
                budget = float(k_match.group(1)) * 1000.0

        # 2. People extraction
        people = 2
        people_word_map = {
            "one": 1, "solo": 1, "myself": 1, "single": 1,
            "two": 2, "couple": 2, "pair": 2,
            "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8
        }
        for word, count in people_word_map.items():
            if re.search(rf'\b{word}\b\s*(?:people|travelers|friends|adults|persons)?', t):
                people = count
                break
        digit_people = re.search(r'(\d+)\s*(?:people|travelers|friends|adults|persons|pax)', t)
        if digit_people:
            people = int(digit_people.group(1))

        # 3. Days extraction
        days = 4
        days_digit = re.search(r'(\d+)\s*(?:days?|day)', t)
        if days_digit:
            days = int(days_digit.group(1))
        elif "weekend" in t:
            days = 2
        elif "week" in t:
            days = 7

        # 4. Origin & Destination extraction
        origin = "Ahmedabad"
        destination = "Jaipur"
        from_to_match = re.search(r'from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s+for|\s+with|\s+under|\s+in|\.|$)', text, re.IGNORECASE)
        if from_to_match:
            origin = from_to_match.group(1).strip().title()
            destination = from_to_match.group(2).strip().title()
        else:
            to_match = re.search(r'(?:travel to|visit|explore|trip to|reach)\s+([a-zA-Z\s]+?)(?:\s+from|\s+for|\s+with|\.|$)', text, re.IGNORECASE)
            if to_match:
                destination = to_match.group(1).strip().title()
            from_match = re.search(r'(?:from|starting from|departing from)\s+([a-zA-Z\s]+?)(?:\s+to|\s+for|\.|$)', text, re.IGNORECASE)
            if from_match:
                origin = from_match.group(1).strip().title()

        # 5. Travel Style
        travel_style = "budget"
        if any(w in t for w in ["luxury", "premium", "5 star", "5-star", "royal", "first class"]):
            travel_style = "premium"
        elif any(w in t for w in ["standard", "mid-range", "comfortable", "3 star"]):
            travel_style = "standard"
        elif any(w in t for w in ["cheap", "budget", "hostel", "backpacker", "economical"]):
            travel_style = "budget"

        # 6. Transport Preferences
        trans_prefs = []
        if "train" in t or "rail" in t or "irctc" in t:
            trans_prefs.append("train")
        if "bus" in t or "volvo" in t:
            trans_prefs.append("bus")
        if "flight" in t or "fly" in t or "air" in t:
            trans_prefs.append("flight")
        if "car" in t or "drive" in t or "road trip" in t:
            trans_prefs.append("car")
        if "cab" in t or "taxi" in t:
            trans_prefs.append("taxi")
        if "bike" in t or "motorcycle" in t or "bullet" in t:
            trans_prefs.append("bike")
        if not trans_prefs:
            trans_prefs = ["train", "bus"]

        # 7. Accommodation Preference
        accommodation = "hostel" if travel_style == "budget" else "hotel"
        if "hostel" in t or "zostel" in t or "dorm" in t:
            accommodation = "hostel"
        elif "resort" in t or "palace" in t or "villa" in t:
            accommodation = "resort"
        elif "homestay" in t:
            accommodation = "homestay"
        elif "hotel" in t:
            accommodation = "hotel"

        # 8. Interests
        interests = []
        interest_keywords = {
            "history": ["history", "historical", "fort", "palace", "monument", "heritage"],
            "local_food": ["food", "cuisine", "street food", "thali", "culinary", "dishes", "tasting"],
            "nature": ["nature", "scenic", "lake", "sunset", "valley", "greenery", "wildlife"],
            "adventure": ["adventure", "trek", "trekking", "safari", "kayaking", "camping"],
            "shopping": ["shopping", "bazaar", "market", "handicrafts", "souvenir"],
            "photography": ["photography", "photo", "viewpoint", "panoramic", "scenery"],
            "culture": ["culture", "cultural", "folk dance", "puppet", "museum", "art"],
            "religious_places": ["temple", "shrine", "pilgrimage", "spiritual", "church", "mosque"],
            "nightlife": ["nightlife", "pub", "bar", "club", "party"],
            "beach": ["beach", "sea", "coastal", "ocean", "waves"],
            "mountains": ["mountain", "hill", "hills", "ghat", "altitude"],
        }
        for category, kws in interest_keywords.items():
            if any(k in t for k in kws):
                interests.append(category)

        if not interests:
            interests = ["history", "local_food", "culture", "photography"]

        return {
            "origin": origin,
            "destination": destination,
            "people": people,
            "days": days,
            "budget": budget,
            "currency": currency,
            "travel_style": travel_style,
            "transport_preferences": trans_prefs,
            "accommodation": accommodation,
            "interests": interests,
            "parsing_method": "DETERMINISTIC_HEURISTIC_PARSER"
        }

heuristic_nlp_parser = HeuristicNLPParser()
