import os
from pathlib import Path
from dotenv import load_dotenv

# Base Directory of ml-service
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env file from ml-service root or project root
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

class Settings:
    # MongoDB Atlas Configuration
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DATABASE: str = os.getenv("MONGODB_DATABASE", "trek")

    # Supabase / PostgreSQL Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # Self-Hosted OSRM Server Endpoint
    OSRM_URL: str = os.getenv("OSRM_URL", "http://localhost:5000")

    # Microservice Server Port and Host
    ML_SERVICE_PORT: int = int(os.getenv("ML_SERVICE_PORT", "8000"))
    ML_SERVICE_HOST: str = os.getenv("ML_SERVICE_HOST", "0.0.0.0")

    # Google Cloud Vision Configuration
    GOOGLE_VISION_API_KEY: str = os.getenv("GOOGLE_VISION_API_KEY", os.getenv("GOOGLE_CLOUD_VISION_API_KEY", ""))
    VISION_PROVIDER: str = os.getenv("VISION_PROVIDER", "google_vision")  # 'google_vision' or 'custom_local'

    # Paths
    BASE_DIR: Path = BASE_DIR
    DATASETS_DIR: Path = BASE_DIR / "datasets"
    TRAINED_MODELS_DIR: Path = BASE_DIR / "trained_models"

    def is_google_vision_configured(self) -> bool:
        return bool(self.GOOGLE_VISION_API_KEY and len(self.GOOGLE_VISION_API_KEY.strip()) > 5 and "<your-" not in self.GOOGLE_VISION_API_KEY)

    def is_mongo_configured(self) -> bool:
        return bool(self.MONGODB_URI and "mongodb" in self.MONGODB_URI and "<username>" not in self.MONGODB_URI)

    def is_supabase_configured(self) -> bool:
        return bool(
            self.SUPABASE_URL
            and self.SUPABASE_KEY
            and "<your-" not in self.SUPABASE_URL
            and not self.SUPABASE_KEY.startswith("postgresql://")
        )

settings = Settings()

# Ensure directories exist
settings.DATASETS_DIR.mkdir(parents=True, exist_ok=True)
settings.TRAINED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
