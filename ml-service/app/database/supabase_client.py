"""
Supabase PostgreSQL Client Helpers for ML Service
Reads relational places, user preferences, and trip details when configured.
"""

from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from app.utils.config import settings
from app.utils.logger import get_logger

logger = get_logger("supabase-client")

_supabase: Optional[Client] = None
_supabase_checked: bool = False

def get_supabase() -> Optional[Client]:
    global _supabase, _supabase_checked
    if _supabase_checked:
        return _supabase

    _supabase_checked = True
    if not settings.is_supabase_configured():
        logger.info("Supabase credentials not configured or using placeholder; operating in standalone mode.")
        _supabase = None
        return None

    try:
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
        return _supabase
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase client: {e}")
        _supabase = None
        return None

def fetch_supabase_places(destination_city: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetch verified places from Supabase if available."""
    client = get_supabase()
    if not client:
        return []

    try:
        query = client.table("places").select("*")
        if destination_city:
            query = query.ilike("address", f"%{destination_city}%")
        res = query.limit(limit).execute()
        return res.data or []
    except Exception as e:
        logger.debug(f"Error querying Supabase places: {e}")
        return []
