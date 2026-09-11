"""
MongoDB Atlas Client & Collection Helpers for ML Service
Connects to the same MongoDB Atlas instance as the Node.js backend.
"""

from typing import Optional, Dict, Any, List
from pymongo import MongoClient
from pymongo.database import Database
from app.utils.config import settings
from app.utils.logger import get_logger

logger = get_logger("mongo-db")

_client: Optional[MongoClient] = None
_db: Optional[Database] = None

def get_mongo_client() -> Optional[MongoClient]:
    global _client
    if _client is not None:
        return _client
    
    if not settings.is_mongo_configured():
        logger.info("MongoDB Atlas URI not configured or using placeholder; operating in standalone ML mode.")
        return None

    try:
        _client = MongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=4000,
            connectTimeoutMS=4000,
        )
        # Verify connection
        _client.admin.command('ping')
        logger.info("Connected to MongoDB Atlas successfully.")
        return _client
    except Exception as e:
        logger.warning(f"MongoDB Atlas connection ping failed: {e}. ML service will use fallback storage.")
        _client = None
        return None

def get_mongo_db() -> Optional[Database]:
    global _db
    if _db is not None:
        return _db
    
    client = get_mongo_client()
    if client:
        _db = client[settings.MONGODB_DATABASE]
        return _db
    return None

def save_prediction_log(prediction_data: Dict[str, Any]) -> bool:
    """Saves ML prediction records for analytics and future active training without blocking."""
    try:
        db = get_mongo_db()
        if db is not None:
            db["ml_predictions"].insert_one(prediction_data)
            return True
    except Exception as e:
        logger.debug(f"Could not write ML prediction log to MongoDB Atlas: {e}")
    return False

def fetch_recent_user_trips(user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves user trip history from MongoDB for personalization if available."""
    try:
        db = get_mongo_db()
        if db is not None:
            query = {"userId": user_id} if user_id else {}
            cursor = db["trips"].find(query).sort("createdAt", -1).limit(limit)
            return list(cursor)
    except Exception as e:
        logger.debug(f"Could not fetch user trips from MongoDB: {e}")
    return []
