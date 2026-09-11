# Trip Planning AI/ML Microservice

A dedicated, high-performance Python FastAPI microservice that provides machine learning inference, trip cost prediction, multi-factor recommendation ranking (transport, hotels, activities), and self-hosted OSRM routing integration.

## Architecture

```
React (Frontend)
   │
   ▼
Node.js + Express (API Gateway & App Backend)
   │
   ▼
Python FastAPI ML Service (Port 8000)
   ├── Self-Hosted OSRM Connector (Road distance, duration, turn-by-turn routes)
   ├── ML Cost Regressor (Random Forest / Gradient Boosting with Joblib serialization)
   ├── Transport Ranking Model (Multi-factor affordability & efficiency scoring)
   ├── Hotel Ranking Model (Rating density, budget alignment, tier ranking)
   ├── Activity Ranking Model (Interest alignment, category matching)
   ├── MongoDB Atlas Client (Optional persistent caching & ML analytics)
   └── Supabase Client (Optional relational place & profile queries)
```

## Quick Start

### 1. Install Dependencies
```bash
python -m pip install -r requirements.txt
```

### 2. Verify Environment
```bash
python verify.py
```

### 3. Train Baseline Models
```bash
python scripts/train_demo.py
```

### 4. Run ML Microservice
```bash
python scripts/run_server.py
# Server runs on http://localhost:8000
```

## API Endpoints

- `GET /health`: Health status and engine metadata
- `POST /predict`: Main prediction endpoint called by Node.js backend
- `POST /predict/trip-cost`: Granular trip cost prediction and breakdown
- `POST /predict/transport`: Candidate transport ranking
- `POST /predict/hotel`: Candidate hotel ranking
- `POST /predict/activity`: Candidate activity ranking
- `POST /recommend/trip`: Full itinerary recommendation
- `POST /osrm/route`: Self-hosted OSRM turn-by-turn road routing
- `POST /osrm/matrix`: Self-hosted OSRM distance and duration matrix
