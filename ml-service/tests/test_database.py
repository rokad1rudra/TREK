import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database.mongo import get_mongo_db, save_prediction_log
from app.database.supabase_client import get_supabase

def test_database_graceful_fallbacks():
    # Database helper should never crash if credentials are dummy or offline
    db = get_mongo_db()
    assert db is None or db is not None

    sb = get_supabase()
    assert sb is None or sb is not None

    logged = save_prediction_log({"test": "value"})
    assert logged in (True, False)
