"""
Comprehensive ML Model Training & Evaluation Script
Trains both Trip Cost Model and Multimodal Transport Model, evaluating with R2 and MAE metrics.
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.training.pipeline import train_and_save_cost_model
from app.training.transport_budget_training import train_and_evaluate_transport_model

def main():
    print("=" * 65)
    print("       TRIP PLANNING ML TRAINING & EVALUATION PIPELINE")
    print("=" * 65)

    print("\n[1/2] Training Trip Cost Prediction Model (Gradient Boosting)...")
    cost_path = train_and_save_cost_model()
    print(f"  -> Saved to: {cost_path}")

    print("\n[2/2] Training Multimodal Transport Ranking Model (Gradient Boosting)...")
    trans_metrics = train_and_evaluate_transport_model()
    print(f"  -> Model Path   : {trans_metrics['model_path']}")
    print(f"  -> Test Set R2  : {trans_metrics['r2_score']}")
    print(f"  -> Test Set MAE : {trans_metrics['mae']} pts")
    print(f"  -> Test Samples : {trans_metrics['test_samples']}")

    print("\n" + "=" * 65)
    print("✅ All ML models trained and serialized successfully to trained_models/")
    print("=" * 65)

if __name__ == "__main__":
    main()
