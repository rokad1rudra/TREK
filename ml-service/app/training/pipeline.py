"""
Training Pipeline for ML Models
Handles synthetic dataset generation, cross validation, model evaluation, and Joblib serialization.
"""

from pathlib import Path
from typing import Dict, Any
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from app.utils.config import settings
from app.utils.logger import get_logger

logger = get_logger("training-pipeline")

def generate_synthetic_training_data(n_samples: int = 1500) -> pd.DataFrame:
    """Generates realistic synthetic trip data for classical ML model training."""
    np.random.seed(42)
    
    distances = np.random.uniform(50.0, 2500.0, n_samples)
    durations = distances / np.random.uniform(45.0, 75.0, n_samples)
    peoples = np.random.choice([1, 2, 3, 4, 5, 6, 8, 10], n_samples, p=[0.2, 0.35, 0.15, 0.15, 0.05, 0.05, 0.03, 0.02])
    days_arr = np.random.choice([2, 3, 4, 5, 6, 7, 10, 14], n_samples, p=[0.1, 0.25, 0.25, 0.15, 0.1, 0.08, 0.05, 0.02])
    
    transports = np.random.choice(["train", "flight", "bus", "road_trip"], n_samples, p=[0.45, 0.25, 0.15, 0.15])
    hotels = np.random.choice(["budget", "comfort", "luxury"], n_samples, p=[0.45, 0.40, 0.15])
    seasons = np.random.choice(["winter", "summer", "monsoon", "spring", "autumn"], n_samples)

    costs = []
    hotel_rates = {"budget": 1200.0, "comfort": 3200.0, "luxury": 7800.0}
    transport_rates = {"train": 1.1, "flight": 4.2, "bus": 0.95, "road_trip": 1.7}

    for i in range(n_samples):
        dist = distances[i]
        ppl = peoples[i]
        d = days_arr[i]
        h_cat = hotels[i]
        t_type = transports[i]

        stay = (d - 1) * hotel_rates[h_cat] * max(1, (ppl + 1) // 2)
        trans = dist * transport_rates[t_type] * ppl
        food = ppl * d * 600.0
        act = ppl * d * 350.0
        noise = np.random.normal(0, 0.05 * (stay + trans + food + act))
        total = round(max(1000.0, stay + trans + food + act + noise), 2)
        costs.append(total)

    df = pd.DataFrame({
        "distance_km": distances.round(1),
        "duration_hours": durations.round(1),
        "people": peoples,
        "days": days_arr,
        "transport_type": transports,
        "hotel_category": hotels,
        "season": seasons,
        "total_cost": costs
    })
    return df

def train_and_save_cost_model() -> Path:
    """Trains regression pipeline and serializes with joblib."""
    logger.info("Starting Trip Cost Prediction Model training...")
    df = generate_synthetic_training_data(2000)

    # Save dataset copy
    dataset_path = settings.DATASETS_DIR / "synthetic_trips.csv"
    df.to_csv(dataset_path, index=False)
    logger.info(f"Saved training dataset to {dataset_path}")

    X = df.drop(columns=["total_cost"])
    y = df["total_cost"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), ['distance_km', 'duration_hours', 'people', 'days']),
            ('cat', OneHotEncoder(handle_unknown='ignore'), ['transport_type', 'hotel_category', 'season'])
        ]
    )

    pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', GradientBoostingRegressor(n_estimators=120, max_depth=4, random_state=42))
    ])

    pipeline.fit(X_train, y_train)
    r2_score = pipeline.score(X_test, y_test)
    logger.info(f"Trip Cost Model Evaluation R2 Score on Test Set: {r2_score:.4f}")

    out_path = settings.TRAINED_MODELS_DIR / "cost_model.joblib"
    joblib.dump(pipeline, out_path)
    logger.info(f"Serialized trained cost model to {out_path}")
    return out_path
