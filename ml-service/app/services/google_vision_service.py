"""
Google Cloud Vision Service for Landmark & Destination Identification
Uses Google Cloud Vision REST API (LANDMARK_DETECTION, WEB_DETECTION, LABEL_DETECTION)
to identify travel monuments, landmarks, scenic spots, and destinations from user photos.
"""

import base64
import re
from typing import Dict, Any, List, Optional
import requests
from app.utils.config import settings
from app.utils.logger import get_logger

logger = get_logger("google-vision-service")

VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"

# Common stopwords to exclude from candidate place names in web detection
EXCLUDE_WEB_ENTITIES = {
    "photograph", "photography", "image", "wallpaper", "sky", "cloud",
    "daytime", "morning", "evening", "night", "building", "tourism",
    "travel", "tourist attraction", "landmark", "world", "place",
    "nature", "water", "landscape", "tree", "plant", "stock photography"
}

CATEGORY_KEYWORDS = {
    "Heritage": ["historic site", "monument", "palace", "fort", "castle", "ancient", "ruins", "archaeological", "memorial", "mausoleum"],
    "Temple": ["temple", "shrine", "mosque", "church", "cathedral", "monastery", "place of worship", "gurdwara", "pagoda"],
    "Beach": ["beach", "coast", "sea", "ocean", "shore", "sand", "bay", "coastal"],
    "Hill Station": ["mountain", "valley", "hill", "highland", "snow", "pass", "peak", "ridge", "alps", "himalayas"],
    "Lake & River": ["lake", "waterfall", "river", "reservoir", "lagoon", "stream", "pond"],
    "Nature & Wildlife": ["national park", "forest", "wildlife", "safari", "flora", "fauna", "jungle"],
    "City & Modern": ["skyline", "cityscape", "skyscraper", "tower", "bridge", "urban area", "metropolis"]
}


def infer_category(text_corpus: str) -> str:
    """Classifies detected text / labels into primary travel category."""
    lower_text = text_corpus.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in lower_text for kw in keywords):
            return cat
    return "Heritage"


class GoogleVisionService:
    """Client for Google Cloud Vision API image landmark and entity recognition."""

    def __init__(self):
        self.api_url = VISION_API_URL

    def is_configured(self) -> bool:
        return settings.is_google_vision_configured()

    def identify_image(self, image_bytes: bytes, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Sends image bytes to Google Cloud Vision API.
        Extracts landmark annotations, web entities, and general labels.
        Returns normalized list of destination matches.
        """
        if not self.is_configured():
            logger.warning("Google Cloud Vision API key is not configured.")
            return [{
                "destination": "Google Vision Key Unconfigured",
                "state": "Unknown",
                "category": "Setup Required",
                "similarity_score": 0.0,
                "status": "unconfigured",
                "is_confident": False,
                "message": "Google Cloud Vision API key is not configured. Add GOOGLE_VISION_API_KEY in ml-service/.env to enable live image landmark identification.",
                "source": "google_cloud_vision"
            }]

        try:
            b64_content = base64.b64encode(image_bytes).decode("utf-8")
            payload = {
                "requests": [
                    {
                        "image": {
                            "content": b64_content
                        },
                        "features": [
                            {"type": "LANDMARK_DETECTION", "maxResults": max(5, top_k)},
                            {"type": "WEB_DETECTION", "maxResults": 10},
                            {"type": "LABEL_DETECTION", "maxResults": 10}
                        ]
                    }
                ]
            }

            params = {"key": settings.GOOGLE_VISION_API_KEY}
            response = requests.post(
                self.api_url,
                params=params,
                json=payload,
                timeout=12.0
            )

            if response.status_code != 200:
                logger.error(f"Google Vision API returned HTTP {response.status_code}: {response.text}")
                return [{
                    "destination": "Vision API Error",
                    "state": "Unknown",
                    "category": "Error",
                    "similarity_score": 0.0,
                    "status": "error",
                    "is_confident": False,
                    "message": f"Google Vision API error {response.status_code}: {response.text[:200]}",
                    "source": "google_cloud_vision"
                }]

            data = response.json()
            responses = data.get("requests") or data.get("responses") or []
            if not responses:
                return [self._empty_match("No response returned by Google Vision API.")]

            res = responses[0]
            if "error" in res:
                err_msg = res["error"].get("message", "Unknown error")
                logger.error(f"Google Vision returned error: {err_msg}")
                return [self._empty_match(f"Google Vision error: {err_msg}")]

            return self._parse_vision_response(res, top_k=top_k)

        except requests.exceptions.RequestException as e:
            logger.error(f"Network error calling Google Cloud Vision API: {e}")
            return [self._empty_match(f"Network error calling Vision API: {str(e)}")]
        except Exception as e:
            logger.error(f"Unexpected error in GoogleVisionService: {e}")
            return [self._empty_match(f"Unexpected vision error: {str(e)}")]

    def _parse_vision_response(self, res: Dict[str, Any], top_k: int = 3) -> List[Dict[str, Any]]:
        """Parses Google Vision response into clean destination matches."""
        landmarks = res.get("landmarkAnnotations") or []
        web_detection = res.get("webDetection") or {}
        label_annotations = res.get("labelAnnotations") or []

        # 1. Collect general labels
        detected_labels = [l.get("description", "") for l in label_annotations if l.get("description")]
        labels_corpus = " ".join(detected_labels)

        # 2. Extract Web Detection entities and Best Guess
        best_guess = ""
        best_guesses = web_detection.get("bestGuessLabels") or []
        if best_guesses and best_guesses[0].get("label"):
            best_guess = best_guesses[0]["label"].strip()

        web_entities = web_detection.get("webEntities") or []
        valid_web_entities = []
        for entity in web_entities:
            desc = entity.get("description", "").strip()
            score = float(entity.get("score", 0.0))
            if desc and desc.lower() not in EXCLUDE_WEB_ENTITIES:
                valid_web_entities.append({"description": desc, "score": score})

        results: List[Dict[str, Any]] = []
        seen_names = set()

        # ── PRIORITY 1: Direct Landmark Annotations ──
        if landmarks:
            for item in landmarks:
                name = item.get("description", "").strip()
                if not name or name.lower() in seen_names:
                    continue
                seen_names.add(name.lower())

                raw_score = float(item.get("score", 0.85))
                sim_score = round(min(99.0, max(50.0, raw_score * 100.0)), 1)

                coords = None
                locations = item.get("locations") or []
                if locations and "latLng" in locations[0]:
                    coords = {
                        "latitude": locations[0]["latLng"].get("latitude"),
                        "longitude": locations[0]["latLng"].get("longitude")
                    }

                category = infer_category(f"{name} {labels_corpus}")

                results.append({
                    "destination": name,
                    "state": "India" if "india" in (name + " " + labels_corpus).lower() else "Verified Landmark",
                    "category": category,
                    "similarity_score": sim_score,
                    "status": "matched",
                    "is_confident": sim_score >= 50.0,
                    "coordinates": coords,
                    "source": "google_cloud_vision",
                    "detection_type": "landmark",
                    "labels": detected_labels[:6],
                    "best_guess": best_guess or name
                })
                if len(results) >= top_k:
                    break

        # ── PRIORITY 2: Web Detection Best Guess & Entities (if no landmark found) ──
        if not results:
            candidate_name = None
            candidate_score = 75.0

            if best_guess:
                candidate_name = best_guess.title()
                candidate_score = 80.0
            elif valid_web_entities:
                candidate_name = valid_web_entities[0]["description"].title()
                candidate_score = round(min(95.0, max(50.0, valid_web_entities[0]["score"] * 100.0)), 1)

            if candidate_name:
                category = infer_category(f"{candidate_name} {labels_corpus}")
                results.append({
                    "destination": candidate_name,
                    "state": "Identified by Web Knowledge",
                    "category": category,
                    "similarity_score": candidate_score,
                    "status": "matched",
                    "is_confident": candidate_score >= 50.0,
                    "coordinates": None,
                    "source": "google_cloud_vision",
                    "detection_type": "web_entity",
                    "labels": detected_labels[:6],
                    "best_guess": best_guess or candidate_name
                })

                # Append additional web entities up to top_k
                for we in valid_web_entities[1:]:
                    we_name = we["description"].title()
                    if we_name.lower() in seen_names or we_name.lower() == candidate_name.lower():
                        continue
                    seen_names.add(we_name.lower())
                    we_score = round(min(90.0, max(45.0, we["score"] * 100.0)), 1)
                    results.append({
                        "destination": we_name,
                        "state": "Related Entity",
                        "category": infer_category(f"{we_name} {labels_corpus}"),
                        "similarity_score": we_score,
                        "status": "matched",
                        "is_confident": we_score >= 50.0,
                        "coordinates": None,
                        "source": "google_cloud_vision",
                        "detection_type": "web_entity",
                        "labels": detected_labels[:6],
                        "best_guess": best_guess
                    })
                    if len(results) >= top_k:
                        break

        # ── PRIORITY 3: Fallback to General Scene Labels ──
        if not results and detected_labels:
            top_label = detected_labels[0].title()
            results.append({
                "destination": f"{top_label} Scene",
                "state": "General Scene",
                "category": infer_category(labels_corpus),
                "similarity_score": 45.0,
                "status": "partial_match",
                "is_confident": False,
                "coordinates": None,
                "source": "google_cloud_vision",
                "detection_type": "label",
                "labels": detected_labels[:6],
                "message": "Specific landmark not identified with high confidence, but general travel scene recognized."
            })

        if not results:
            return [self._empty_match("No recognizable landmark, web entity, or scene detected in this photo.")]

        return results

    def _empty_match(self, message: str) -> Dict[str, Any]:
        return {
            "destination": "Unknown Landmark",
            "state": "Unknown",
            "category": "Unmatched",
            "similarity_score": 0.0,
            "status": "unmatched",
            "is_confident": False,
            "message": message,
            "source": "google_cloud_vision"
        }


# Singleton instance
google_vision_service = GoogleVisionService()
