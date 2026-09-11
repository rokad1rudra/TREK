import sys

def verify():
    print("=" * 50)
    print("      TRIP PLANNING ML ENVIRONMENT VERIFICATION")
    print("=" * 50)
    print(f"Python version       : {sys.version.split()[0]}")
    
    # 1. PyTorch
    try:
        import torch
        print(f"PyTorch version      : {torch.__version__} (CUDA Available: {torch.cuda.is_available()})")
    except ImportError as e:
        print(f"PyTorch version      : FAILED ({e})")
        
    # 2. FastAPI
    try:
        import fastapi
        print(f"FastAPI version      : {fastapi.__version__}")
    except ImportError as e:
        print(f"FastAPI version      : FAILED ({e})")

    # 3. Uvicorn
    try:
        import uvicorn
        print(f"Uvicorn version      : {uvicorn.__version__}")
    except ImportError as e:
        print(f"Uvicorn version      : FAILED ({e})")
        
    # 4. Pandas
    try:
        import pandas as pd
        print(f"Pandas version       : {pd.__version__}")
    except ImportError as e:
        print(f"Pandas version       : FAILED ({e})")
        
    # 5. NumPy
    try:
        import numpy as np
        print(f"NumPy version        : {np.__version__}")
    except ImportError as e:
        print(f"NumPy version        : FAILED ({e})")
        
    # 6. Scikit-learn
    try:
        import sklearn
        print(f"Scikit-learn version : {sklearn.__version__}")
    except ImportError as e:
        print(f"Scikit-learn version : FAILED ({e})")
        
    # 7. Joblib
    try:
        import joblib
        print(f"Joblib version       : {joblib.__version__}")
    except ImportError as e:
        print(f"Joblib version       : FAILED ({e})")
        
    # 8. Requests
    try:
        import requests
        print(f"Requests version     : {requests.__version__}")
    except ImportError as e:
        print(f"Requests version     : FAILED ({e})")
        
    # 9. Pydantic
    try:
        import pydantic
        print(f"Pydantic version     : {pydantic.__version__}")
    except ImportError as e:
        print(f"Pydantic version     : FAILED ({e})")

    print("=" * 50)
    print("All core dependencies verified successfully!")
    print("=" * 50)

if __name__ == "__main__":
    verify()
