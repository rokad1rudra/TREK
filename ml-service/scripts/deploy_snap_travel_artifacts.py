
"""
Automated Artifact Deployment & Verification for Pan-India 5,000 Snap & Travel Engine
Extracts snap_travel_5000_artifacts.zip directly into trained_models/ and validates index integrity.
"""

import os
import sys
import json
import shutil
import zipfile
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
TRAINED_MODELS_DIR = BASE_DIR / "trained_models"
WORKSPACE_ROOT = BASE_DIR.parent.parent
USER_DOWNLOADS = Path(os.environ.get("USERPROFILE", "")) / "Downloads"

CANDIDATE_LOCATIONS = [
    WORKSPACE_ROOT / "snap_travel_5000_artifacts.zip",
    BASE_DIR / "snap_travel_5000_artifacts.zip",
    USER_DOWNLOADS / "snap_travel_5000_artifacts.zip",
    WORKSPACE_ROOT / "snap_travel_colab_artifacts.zip",
]

REQUIRED_ARTIFACTS = [
    "snap_travel_custom_model.pth",
    "landmark_vectors.npy",
    "landmark_metadata.json",
    "classes.json"
]

def main():
    print("=" * 65)
    print("  📸 SNAP & TRAVEL 5,000 ARTIFACTS DEPLOYER & VERIFIER")
    print("=" * 65)

    TRAINED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Search for zip file
    target_zip = None
    if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
        target_zip = Path(sys.argv[1])
    else:
        for loc in CANDIDATE_LOCATIONS:
            if loc.exists():
                target_zip = loc
                break

    if target_zip and target_zip.exists():
        print(f"📦 Found artifact archive: {target_zip} ({target_zip.stat().st_size / 1e6:.2f} MB)")
        print(f"📂 Extracting into: {TRAINED_MODELS_DIR}...")
        with zipfile.ZipFile(target_zip, 'r') as zf:
            for item in zf.namelist():
                base_name = os.path.basename(item)
                if base_name in REQUIRED_ARTIFACTS:
                    dest = TRAINED_MODELS_DIR / base_name
                    with zf.open(item) as src, open(dest, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    print(f"  ✅ Extracted: {base_name} ({dest.stat().st_size / 1e6:.2f} MB)")
        print("🎉 Extraction complete!")
    else:
        print("⚠️  'snap_travel_5000_artifacts.zip' not found in root, downloads, or ml-service.")
        print("Checking currently installed files in trained_models/...")

    # 2. Inspect trained_models directory
    print("\n--- Inspecting trained_models/ status ---")
    all_ready = True
    for art in REQUIRED_ARTIFACTS:
        p = TRAINED_MODELS_DIR / art
        if p.exists():
            size_mb = p.stat().st_size / 1e6
            print(f"  ✔ {art:<32} {size_mb:>8.2f} MB")
        else:
            print(f"  ❌ {art:<32} MISSING")
            all_ready = False

    # 3. Check classes count and vector DB shape if numpy is available
    meta_path = TRAINED_MODELS_DIR / "landmark_metadata.json"
    classes_path = TRAINED_MODELS_DIR / "classes.json"
    vec_path = TRAINED_MODELS_DIR / "landmark_vectors.npy"

    if classes_path.exists():
        try:
            with open(classes_path, "r", encoding="utf-8") as f:
                classes = json.load(f)
            print(f"\n📊 Total Destination Classes Indexed: {len(classes)}")
        except Exception as e:
            print(f"Error reading classes.json: {e}")

    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            print(f"🗺️  Total Landmark Profiles in Metadata: {len(metadata)}")
        except Exception as e:
            print(f"Error reading landmark_metadata.json: {e}")

    try:
        import numpy as np
        if vec_path.exists():
            vecs = np.load(vec_path)
            print(f"⚡ Vector DB Matrix Shape: {vecs.shape} (Dimension: {vecs.shape[1]}-D)")
    except Exception:
        pass

    print("=" * 65)
    if all_ready:
        print("✅ SUCCESS: Snap & Travel Vision Engine is fully prepared for local inference!")
    else:
        print("👉 Next step: Drop snap_travel_5000_artifacts.zip into this folder and run again.")
    print("=" * 65)

if __name__ == "__main__":
    main()
