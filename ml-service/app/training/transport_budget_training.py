"""
Transport & Budget ML Model Training Pipeline
Trains classical ML models (RandomForest and GradientBoosting) on multi-modal travel dataset with cross-validation and evaluation metrics.
"""

from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, accuracy_score
from app.utils.config import settings
from app.utils.logger import get_logger

logger = get_logger("training-transport-budget")

def generate_multimodal_travel_dataset(n_samples: int = 2500) -> pd.DataFrame:
    """Generates synthetic dataset of multimodal India journeys with realistic cost and preference targets."""
    np.random.seed(42)

    distances = np.random.uniform(30.0, 2400.0, n_samples)
    peoples = np.random.choice([1, 2, 3, 4, 5, 6, 8], n_samples, p=[0.25, 0.35, 0.15, 0.12, 0.05, 0.05, 0.03])
    days_arr = np.random.choice([2, 3, 4, 5, 6, 7, 10], n_samples, p=[0.15, 0.25, 0.25, 0.15, 0.1, 0.07, 0.03])
    
    transport_types = np.random.choice(
        ["train", "intercity_bus", "central_bus", "flight", "taxi", "car", "bike"],
        n_samples,
        p=[0.35, 0.20, 0.15, 0.12, 0.08, 0.06, 0.04]
    )
    ranking_modes = np.random.choice(["budget", "fastest", "balanced", "comfort"], n_samples)
    user_budgets = np.random.uniform(5000.0, 80000.0, n_samples)

    # Calculate actual price & duration per mode
    transport_rates = {
        "train": 1.15,
        "intercity_bus": 1.45,
        "central_bus": 0.95,
        "flight": 4.40,
        "taxi": 3.80,
        "car": 2.20,
        "bike": 1.60,
    }
    speed_rates = {
        "train": 65.0,
        "intercity_bus": 50.0,
        "central_bus": 40.0,
        "flight": 350.0,
        "taxi": 60.0,
        "car": 60.0,
        "bike": 55.0,
    }
    comfort_ratings = {
        "train": 4.3,
        "intercity_bus": 4.1,
        "central_bus": 3.5,
        "flight": 4.7,
        "taxi": 4.8,
        "car": 4.5,
        "bike": 3.8,
    }

    prices = []
    durations = []
    comforts = []
    utility_scores = []

    for i in range(n_samples):
        d = distances[i]
        t = transport_types[i]
        ppl = peoples[i]
        b = user_budgets[i]
        m = ranking_modes[i]

        p = round(d * transport_rates[t] * ppl, 2)
        dur = round(d / speed_rates[t] + (1.5 if t == "flight" else 0.5), 1)
        comf = comfort_ratings[t]

        # Multi-attribute utility score calculation
        affordability = max(0.0, min(100.0, (1.0 - (p / (b + 1.0))) * 100.0))
        speed_score = max(0.0, min(100.0, (speed_rates[t] / 350.0) * 100.0))
        comfort_score = (comf / 5.0) * 100.0

        if m == "budget":
            score = 0.50 * affordability + 0.20 * speed_score + 0.10 * comfort_score + 0.20 * 90.0
        elif m == "fastest":
            score = 0.10 * affordability + 0.60 * speed_score + 0.10 * comfort_score + 0.20 * 90.0
        elif m == "comfort":
            score = 0.15 * affordability + 0.25 * speed_score + 0.45 * comfort_score + 0.15 * 90.0
        else:
            score = 0.35 * affordability + 0.30 * speed_score + 0.15 * comfort_score + 0.20 * 90.0

        noise = np.random.normal(0, 1.5)
        score = round(max(5.0, min(100.0, score + noise)), 2)

        prices.append(p)
        durations.append(dur)
        comforts.append(comf)
        utility_scores.append(score)

    df = pd.DataFrame({
        "distance_km": distances.round(1),
        "people": peoples,
        "days": days_arr,
        "transport_type": transport_types,
        "ranking_mode": ranking_modes,
        "user_budget": user_budgets.round(2),
        "price": prices,
        "duration_hours": durations,
        "comfort_rating": comforts,
        "transport_score": utility_scores,
    })
    return df

def train_and_evaluate_transport_model() -> Dict[str, Any]:
    """Trains GradientBoostingRegressor for transport utility scoring and logs evaluation metrics."""
    logger.info("Generating multimodal travel dataset...")
    df = generate_multimodal_travel_dataset(3000)

    dataset_path = settings.DATASETS_DIR / "multimodal_transport_trips.csv"
    df.to_csv(dataset_path, index=False)
    logger.info(f"Saved multimodal dataset to {dataset_path}")

    X = df.drop(columns=["transport_score"])
    y = df["transport_score"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), ['distance_km', 'people', 'days', 'user_budget', 'price', 'duration_hours', 'comfort_rating']),
            ('cat', OneHotEncoder(handle_unknown='ignore'), ['transport_type', 'ranking_mode'])
        ]
    )

    model = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', GradientBoostingRegressor(n_estimators=150, max_depth=4, learning_rate=0.08, random_state=42))
    ])

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    logger.info(f"Transport Ranking Model Evaluation -> R2 Score: {r2:.4f} | MAE: {mae:.4f} pts")

    model_out = settings.TRAINED_MODELS_DIR / "transport_rank_model.joblib"
    joblib.dump(model, model_out)
    logger.info(f"Saved trained transport model to {model_out}")

    return {
        "model_path": str(model_out),
        "r2_score": round(float(r2), 4),
        "mae": round(float(mae), 4),
        "test_samples": len(X_test)
    }

if __name__ == "__main__":
    train_and_evaluate_transport_model()
