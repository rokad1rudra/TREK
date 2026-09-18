"""
Unit Tests for Google Cloud Vision Service & Snap & Travel Integration
"""

import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import io
from PIL import Image

from app.main import app
from app.utils.config import settings
from app.services.google_vision_service import GoogleVisionService, infer_category
from app.services.snap_travel_service import snap_travel_service


class TestGoogleVisionService(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.vision_service = GoogleVisionService()

    def test_category_inference(self):
        self.assertEqual(infer_category("Taj Mahal historic site mausoleum"), "Heritage")
        self.assertEqual(infer_category("Golden Temple Amritsar shrine gurdwara"), "Temple")
        self.assertEqual(infer_category("Baga Beach ocean coast Goa sand"), "Beach")
        self.assertEqual(infer_category("Solang Valley mountain peak snow Alps"), "Hill Station")
        self.assertEqual(infer_category("Pangong Lake water reservoir"), "Lake & River")

    def test_unconfigured_fallback(self):
        with patch.object(settings, "is_google_vision_configured", return_value=False):
            res = self.vision_service.identify_image(b"fake_image_bytes")
            self.assertEqual(len(res), 1)
            self.assertEqual(res[0]["status"], "unconfigured")
            self.assertFalse(res[0]["is_confident"])
            self.assertIn("API key is not configured", res[0]["message"])

    def test_landmark_parsing(self):
        mock_response = {
            "responses": [
                {
                    "landmarkAnnotations": [
                        {
                            "description": "Taj Mahal",
                            "score": 0.94,
                            "locations": [
                                {
                                    "latLng": {
                                        "latitude": 27.1751,
                                        "longitude": 78.0421
                                    }
                                }
                            ]
                        }
                    ],
                    "labelAnnotations": [
                        {"description": "Historic site", "score": 0.98},
                        {"description": "Monument", "score": 0.95}
                    ]
                }
            ]
        }

        mock_http_res = MagicMock()
        mock_http_res.status_code = 200
        mock_http_res.json.return_value = mock_response

        with patch.object(settings, "is_google_vision_configured", return_value=True):
            with patch.object(settings, "GOOGLE_VISION_API_KEY", "AIzaSyTestKey12345"):
                with patch("requests.post", return_value=mock_http_res):
                    matches = self.vision_service.identify_image(b"image_content", top_k=3)
                    self.assertEqual(len(matches), 1)
                    top = matches[0]
                    self.assertEqual(top["destination"], "Taj Mahal")
                    self.assertEqual(top["category"], "Heritage")
                    self.assertEqual(top["similarity_score"], 94.0)
                    self.assertTrue(top["is_confident"])
                    self.assertIsNotNone(top["coordinates"])
                    self.assertAlmostEqual(top["coordinates"]["latitude"], 27.1751)
                    self.assertAlmostEqual(top["coordinates"]["longitude"], 78.0421)
                    self.assertEqual(top["source"], "google_cloud_vision")

    def test_web_detection_parsing(self):
        mock_response = {
            "responses": [
                {
                    "webDetection": {
                        "bestGuessLabels": [{"label": "amber palace jaipur"}],
                        "webEntities": [
                            {"description": "Amber Palace", "score": 0.88},
                            {"description": "Jaipur", "score": 0.72}
                        ]
                    },
                    "labelAnnotations": [
                        {"description": "Palace", "score": 0.90}
                    ]
                }
            ]
        }

        mock_http_res = MagicMock()
        mock_http_res.status_code = 200
        mock_http_res.json.return_value = mock_response

        with patch.object(settings, "is_google_vision_configured", return_value=True):
            with patch.object(settings, "GOOGLE_VISION_API_KEY", "AIzaSyTestKey12345"):
                with patch("requests.post", return_value=mock_http_res):
                    matches = self.vision_service.identify_image(b"image_content", top_k=2)
                    self.assertGreaterEqual(len(matches), 1)
                    top = matches[0]
                    self.assertEqual(top["destination"], "Amber Palace Jaipur")
                    self.assertEqual(top["category"], "Heritage")
                    self.assertTrue(top["is_confident"])
                    self.assertEqual(top["detection_type"], "web_entity")

    def test_snap_travel_status_api(self):
        resp = self.client.get("/predict/snap-travel/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("active_provider", data)
        self.assertIn("google_vision_configured", data)
        self.assertIn("custom_vector_engine_ready", data)

    def test_predict_snap_travel_endpoint(self):
        # Create a dummy JPEG image in memory
        img = Image.new("RGB", (100, 100), color=(73, 109, 137))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        # Upload to /predict/snap-travel
        response = self.client.post(
            "/predict/snap-travel",
            files={"file": ("test.jpg", buf, "image/jpeg")},
            data={"top_k": 3}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("matches", data)
        self.assertIn("top_destination", data)
        self.assertIn("vision_provider", data)


if __name__ == "__main__":
    unittest.main()
