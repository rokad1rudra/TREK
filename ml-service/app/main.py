"""
Main FastAPI Application Entrypoint
Trip Planning AI/ML Microservice
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.utils.config import settings
from app.utils.logger import get_logger
from app.database.mongo import get_mongo_client
from app.database.supabase_client import get_supabase
from app.inference.engine import inference_engine

logger = get_logger("main-app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ML microservice...")
    # Initialize DB connections (non-blocking checks)
    get_mongo_client()
    get_supabase()
    # Confirm models are loaded
    if inference_engine.cost_model is not None:
        logger.info("ML Models initialized and ready for inference.")
    else:
        logger.info("ML fallback logic initialized.")
    yield
    logger.info("Shutting down ML microservice.")

app = FastAPI(
    title="Trip Planning ML Service",
    description="Dedicated AI/ML microservice for itinerary generation, cost prediction, transport & hotel ranking, and OSRM routing.",
    version="1.0.0",
    lifespan=lifespan
)

# Allow CORS for internal Node.js backend & local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.ML_SERVICE_HOST,
        port=settings.ML_SERVICE_PORT,
        reload=True
    )
