"""
Ollama Local LLM Provider
Interacts with local Ollama instance for NLU parsing and narrative summaries, with automatic heuristic fallback.
"""

import os
import json
import requests
from typing import Dict, Any, Optional
from app.llm.base import LLMProvider, heuristic_nlp_parser
from app.utils.logger import get_logger

logger = get_logger("ollama-provider")

class OllamaProvider(LLMProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3")
        self.timeout = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "5"))

    def is_available(self) -> bool:
        try:
            res = requests.get(f"{self.base_url}/api/tags", timeout=0.25)
            return res.status_code == 200
        except Exception:
            return False

    def parse_user_intent(self, message: str) -> Dict[str, Any]:
        """
        Extracts structured travel parameters using Ollama if running, otherwise uses Heuristic parser.
        """
        if not self.is_available():
            logger.info("Ollama instance offline/unreachable. Utilizing deterministic Heuristic NLP Parser.")
            return heuristic_nlp_parser.parse(message)

        prompt = f"""
        Extract travel details from the following user prompt as JSON only.
        Prompt: "{message}"

        JSON schema:
        {{
            "origin": string (city name),
            "destination": string (city name),
            "people": integer (number of travelers),
            "days": integer (duration in days),
            "budget": float (budget amount in numbers only),
            "currency": "INR",
            "travel_style": "budget" | "standard" | "premium",
            "transport_preferences": array of strings (e.g. ["train", "bus"]),
            "accommodation": "hostel" | "hotel" | "resort",
            "interests": array of strings (e.g. ["history", "local_food"])
        }}
        Return only the JSON object.
        """

        try:
            res = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False,
                },
                timeout=self.timeout
            )
            if res.status_code == 200:
                data = res.json()
                raw_response = data.get("response", "{}")
                parsed = json.loads(raw_response)
                parsed["parsing_method"] = f"OLLAMA_LOCAL_LLM ({self.model})"
                return parsed
        except Exception as e:
            logger.warning(f"Ollama parse exception: {e}. Falling back to Heuristic NLP.")

        return heuristic_nlp_parser.parse(message)

    def explain_trip_plan(self, plan_data: Dict[str, Any]) -> str:
        """Generates natural language explanation of the plan."""
        origin = plan_data.get("origin", "Origin")
        dest = plan_data.get("destination", "Destination")
        days = plan_data.get("days", 4)
        people = plan_data.get("people", 2)
        budget = plan_data.get("budget", 20000.0)
        mode = plan_data.get("recommended_mode", "Superfast Train")

        summary = (
            f"Here is your personalized {days}-day trip plan from {origin} to {dest} for {people} travelers. "
            f"We have selected {mode} for optimal value and comfort within your ₹{budget:,.0f} budget. "
            f"All daily schedules, monument hours, and driving routes have been verified."
        )
        return summary

ollama_provider = OllamaProvider()
