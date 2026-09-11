"""
Server Runner Script
Starts Uvicorn server for the ML Microservice on port 8000.
"""

import sys
from pathlib import Path

# Add ml-service root to pythonpath
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import uvicorn
from app.utils.config import settings

def main():
    print(f"🚀 Starting Trip Planning ML Microservice on http://{settings.ML_SERVICE_HOST}:{settings.ML_SERVICE_PORT}")
    uvicorn.run(
        "app.main:app",
        host=settings.ML_SERVICE_HOST,
        port=settings.ML_SERVICE_PORT,
        reload=False
    )

if __name__ == "__main__":
    main()
