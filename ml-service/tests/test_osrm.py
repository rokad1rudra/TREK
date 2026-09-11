import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.osrm_service import osrm_service

def test_osrm_distance():
    ahmedabad = (72.5714, 23.0225)
    jaipur = (75.7873, 26.9124)
    dist = osrm_service.distance(ahmedabad, jaipur)
    assert dist > 100.0

def test_osrm_route():
    ahmedabad = (72.5714, 23.0225)
    jaipur = (75.7873, 26.9124)
    res = osrm_service.route([ahmedabad, jaipur])
    assert "routes" in res or "code" in res
    assert res.get("code") == "Ok"
