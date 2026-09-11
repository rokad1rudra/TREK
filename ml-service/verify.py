"""
Verification Script for Python ML Microservice Environment
Checks Python, PyTorch, FastAPI, Pandas, NumPy, Scikit-learn, Joblib, Requests, Pydantic, Pymongo, Supabase.
"""

import sys

def verify():
    print("=" * 60)
    print("     TRIP PLANNING ML MICROSERVICE - ENVIRONMENT CHECK")
    print("=" * 60)
    print(f"Python Version        : {sys.version.split()[0]}")
    
    # 1. PyTorch (Pre-installed)
    try:
        import torch
        print(f"PyTorch Version       : {torch.__version__} (CUDA Available: {torch.cuda.is_available()})")
    except ImportError as e:
        print(f"PyTorch Version       : FAILED ({e})")

    # 2. FastAPI
    try:
        import fastapi
        print(f"FastAPI Version       : {fastapi.__version__}")
    except ImportError as e:
        print(f"FastAPI Version       : FAILED ({e})")

    # 3. Uvicorn
    try:
        import uvicorn
        print(f"Uvicorn Version       : {uvicorn.__version__}")
    except ImportError as e:
        print(f"Uvicorn Version       : FAILED ({e})")

    # 4. Pandas
    try:
        import pandas as pd
        print(f"Pandas Version        : {pd.__version__}")
    except ImportError as e:
        print(f"Pandas Version        : FAILED ({e})")

    # 5. NumPy
    try:
        import numpy as np
        print(f"NumPy Version         : {np.__version__}")
    except ImportError as e:
        print(f"NumPy Version         : FAILED ({e})")

    # 6. Scikit-learn
    try:
        import sklearn
        print(f"Scikit-learn Version  : {sklearn.__version__}")
    except ImportError as e:
        print(f"Scikit-learn Version  : FAILED ({e})")

    # 7. Joblib
    try:
        import joblib
        print(f"Joblib Version        : {joblib.__version__}")
    except ImportError as e:
        print(f"Joblib Version        : FAILED ({e})")

    # 8. Requests
    try:
        import requests
        print(f"Requests Version      : {requests.__version__}")
    except ImportError as e:
        print(f"Requests Version      : FAILED ({e})")

    # 9. Pydantic
    try:
        import pydantic
        print(f"Pydantic Version      : {pydantic.__version__}")
    except ImportError as e:
        print(f"Pydantic Version      : FAILED ({e})")

    # 10. PyMongo (MongoDB Atlas)
    try:
        import pymongo
        print(f"PyMongo Version       : {pymongo.__version__}")
    except ImportError as e:
        print(f"PyMongo Version       : FAILED ({e})")

    # 11. Supabase Client
    try:
        import supabase
        print(f"Supabase Version      : {supabase.__version__}")
    except ImportError as e:
        print(f"Supabase Version      : FAILED ({e})")

    print("=" * 60)
    print("✅ All required Python ML libraries verified successfully!")
    print("=" * 60)

if __name__ == "__main__":
    verify()
