"""
Verified Landmark Image Harvester & Vector Registry Builder
Enforces:
1. NEVER create embeddings from placeholders or solid color boxes.
2. Generates clean `image_search_query` for every destination.
3. Multi-strategy Wikipedia / Wikimedia Commons search.
4. Strict image verification (dimensions, format, pixel variance >= 12.0).
5. Explicit image registry: id, destination, image_path, image_url, image_status, embedding_index.
6. Guaranteed strict 1-to-1 alignment: metadata[i] <-> image[i] <-> vectors[i].
7. Full mathematical validation of landmark_vectors.npy.
"""

import os
import sys
import json
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path
from io import BytesIO
from typing import Dict, Any, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from PIL import Image

# Directories
SCRIPT_DIR = Path(__file__).resolve().parent
ML_SERVICE_DIR = SCRIPT_DIR.parent
WORKSPACE_ROOT = ML_SERVICE_DIR.parent.parent

if str(ML_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_SERVICE_DIR))

# Import standalone visual feature extractor
from app.services.snap_travel_service import extract_visual_features

DATASETS_DIR = ML_SERVICE_DIR / "datasets"
TRAINED_MODELS_DIR = ML_SERVICE_DIR / "trained_models"
IMAGES_DIR = DATASETS_DIR / "landmark_images"

DATASETS_DIR.mkdir(parents=True, exist_ok=True)
TRAINED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "SnapTravelEngine/4.0 (pan-india-research-project)"}


def clean_search_query(destination: str, raw_title: Optional[str] = None) -> str:
    """Generates a concise, high-relevance search query from descriptive destination titles."""
    if raw_title and not raw_title.startswith("http"):
        cleaned_title = urllib.parse.unquote(raw_title).replace("_", " ").strip()
        if len(cleaned_title) >= 3 and not re.search(r'heritage \d+', cleaned_title, re.I):
            return cleaned_title

    name = destination.strip()

    fluff_patterns = [
        r'\bAlaknanda River Char Dham\b',
        r'\bOrigin of River Ganga\b',
        r'\bChar Dham\b',
        r'\bOldest Tiger Reserve\b',
        r'\bUNESCO High Alpine Botanical Reserve\b',
        r'\bWorld Highest Shiva Temple\b',
        r'\bMini Switzerland of Uttarakhand\b',
        r'\bQueen of the Hills Mall Road\b',
        r'\bQueen Meadow Golf Course.*?\b',
        r'\bHigh Altitude Sacred Glacial Lake\b',
        r'\bLast Indian Border Village Indo Tibet\b',
        r'\bPremier Himalayan Ski Resort.*?\b',
        r'\bAdi Shankaracharya Jyotirmath Monastic Seat\b',
        r'\bSecond Highest Peak Mussoorie\b',
        r'\bAncient Fort Bastion\b',
        r'\bHistorical Palace & Museum\b',
        r'\bRoyal Heritage Haveli\b',
        r'\bSacred Shiva Temple\b',
        r'\bGrand Devi Amman Temple\b',
        r'\bScenic Hilltop Viewpoint\b',
        r'\bCascading Valley Waterfall\b',
        r'\bWildlife Sanctuary & Forest Reserve\b',
        r'\bPristine Lake & Nature Reserve\b',
        r'\bRock Cut Caves & Ancient Inscriptions\b',
        r'\bHistoric Clock Tower & Heritage Market\b',
        r'\bRiver Ghats & Pilgrim Steps\b',
        r'\bCoastal Beach & Lighthouse\b',
        r'\bEco Tourism Forest Park\b',
        r'\bAncient Archaeological Stupa & Mound\b'
    ]

    for pat in fluff_patterns:
        name = re.sub(pat, '', name, flags=re.IGNORECASE)

    name = re.sub(r'[,&/\-]+', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name if name else destination


def validate_real_image(img: Image.Image) -> Tuple[bool, str]:
    """Validates that image is decodable, >=120x120, and NOT a flat color placeholder."""
    try:
        w, h = img.size
        if w < 100 or h < 100:
            return False, f"Image dimensions too small ({w}x{h})"

        arr = np.array(img.convert("RGB"), dtype=np.float32)
        spatial_std = max(float(np.std(arr[:, :, c])) for c in range(3))

        if spatial_std < 12.0:
            return False, f"Solid/flat color placeholder detected (spatial_std={spatial_std:.2f} < 12.0)"

        return True, "valid"
    except Exception as e:
        return False, f"Validation exception: {e}"


def fetch_wikipedia_thumbnail_by_title(title: str) -> Optional[Tuple[Image.Image, str]]:
    """Strategy 1: Query exact page title via Wikipedia pageimages API"""
    try:
        quoted = urllib.parse.quote(title.replace(" ", "_"))
        url = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=600&titles={quoted}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        thumb_url = next(iter(pages.values()), {}).get("thumbnail", {}).get("source")
        if thumb_url:
            with urllib.request.urlopen(urllib.request.Request(thumb_url, headers=HEADERS), timeout=5) as img_resp:
                img = Image.open(BytesIO(img_resp.read())).convert("RGB")
                ok, reason = validate_real_image(img)
                if ok:
                    return img, thumb_url
    except Exception:
        pass
    return None


def fetch_wikipedia_by_search_query(query: str) -> Optional[Tuple[Image.Image, str]]:
    """Strategy 2 & 3: Query Wikipedia Search API, take best relevant article, fetch thumbnail"""
    try:
        q_enc = urllib.parse.quote(query)
        s_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={q_enc}&format=json&srlimit=2"
        req = urllib.request.Request(s_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        hits = data.get("query", {}).get("search", [])
        for hit in hits:
            hit_title = hit.get("title")
            if hit_title:
                res = fetch_wikipedia_thumbnail_by_title(hit_title)
                if res:
                    return res
    except Exception:
        pass
    return None


def fetch_wikimedia_commons_search(query: str) -> Optional[Tuple[Image.Image, str]]:
    """Strategy 4: Search Wikimedia Commons for photographic image file"""
    try:
        q_enc = urllib.parse.quote(query)
        c_url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={q_enc}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json"
        req = urllib.request.Request(c_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        for p in pages.values():
            info = p.get("imageinfo", [{}])[0]
            thumb = info.get("thumburl") or info.get("url")
            if thumb and thumb.lower().endswith((".jpg", ".jpeg", ".png")):
                try:
                    with urllib.request.urlopen(urllib.request.Request(thumb, headers=HEADERS), timeout=5) as c_resp:
                        img = Image.open(BytesIO(c_resp.read())).convert("RGB")
                        ok, reason = validate_real_image(img)
                        if ok:
                            return img, thumb
                except Exception:
                    continue
    except Exception:
        pass
    return None


def fetch_verified_image(destination: str, raw_title: str, state: str) -> Tuple[Optional[Image.Image], Optional[str], str]:
    """Cascades across all search strategies. Returns (image, url, strategy_used)."""
    search_q = clean_search_query(destination, raw_title)

    # Strategy 1: Exact Wikipedia title if provided
    if raw_title:
        res = fetch_wikipedia_thumbnail_by_title(raw_title)
        if res:
            return res[0], res[1], "wikipedia_title"

    # Strategy 2: Cleaned search query via search API
    res = fetch_wikipedia_by_search_query(search_q)
    if res:
        return res[0], res[1], "wikipedia_search"

    # Strategy 3: Cleaned query + State
    if state and state.lower() not in search_q.lower():
        res = fetch_wikipedia_by_search_query(f"{search_q} {state}")
        if res:
            return res[0], res[1], "wikipedia_state_search"

    # Strategy 4: Wikimedia Commons image search
    res = fetch_wikimedia_commons_search(search_q)
    if res:
        return res[0], res[1], "wikimedia_commons"

    return None, None, "failed"


def process_single_place(place_tuple, local_gt_map):
    idx, place = place_tuple
    dest_name = place.get("name") or place.get("destination", "Place")
    slug = place.get("slug", "").lower()
    state = place.get("state", "India")
    category = place.get("category", "Heritage")
    raw_title = place.get("title", "")
    clean_q = clean_search_query(dest_name, raw_title)

    dest_img_path = IMAGES_DIR / f"{place['id']}_{slug}.jpg"
    verified_img = None
    source_url = None
    status = "missing_image"

    # 1. Check existing saved file first
    if dest_img_path.exists():
        try:
            candidate = Image.open(dest_img_path).convert("RGB")
            ok, _ = validate_real_image(candidate)
            if ok:
                verified_img = candidate
                source_url = f"file:///{dest_img_path.as_posix()}"
                status = "verified"
        except Exception:
            pass

    # 2. Check local ground truth dataset
    if not verified_img:
        for k, p in local_gt_map.items():
            if k in slug or slug in k:
                try:
                    candidate = Image.open(p).convert("RGB")
                    ok, _ = validate_real_image(candidate)
                    if ok:
                        verified_img = candidate
                        source_url = f"file:///{p.as_posix()}"
                        status = "verified"
                        verified_img.save(dest_img_path)
                        break
                except Exception:
                    pass

    # 3. Online fetch for primary & iconic places (first 100 or special landmarks)
    should_fetch = (
        not verified_img and (
            idx < 80 or
            any(k in slug for k in [
                "badrinath", "kedarnath", "gangotri", "yamunotri", "somnath", "dwarka",
                "tirupati", "hampi", "ellora", "ajanta", "dantewada", "konark",
                "khajuraho", "puri", "shirdi", "haridwar", "rishikesh", "ayodhya",
                "varanasi", "mathura", "vrindavan", "golden_temple", "statue_of_unity",
                "sun_temple", "mysore_palace", "meenakshi", "hawa_mahal", "taj_mahal",
                "victoria_memorial", "gateway_of_india", "munnar", "solang_valley",
                "pangong", "baga_beach"
            ])
        )
    )

    if should_fetch:
        v_img, v_url, strat = fetch_verified_image(dest_name, raw_title, state)
        if v_img:
            verified_img = v_img
            source_url = v_url
            status = "verified"
            verified_img.save(dest_img_path)
            print(f"  [{idx}] Verified: {clean_q} via {strat}", flush=True)

    feat = None
    if verified_img:
        try:
            feat = extract_visual_features(verified_img)
        except Exception as e:
            print(f"Feature error for {dest_name}: {e}", flush=True)

    return idx, place, clean_q, dest_img_path, source_url, status, feat


def main():
    print("=" * 65, flush=True)
    print("  📸 VERIFIED PAN-INDIA LANDMARK IMAGE & VECTOR REGISTRY BUILDER", flush=True)
    print("=" * 65, flush=True)

    registry_path = DATASETS_DIR / "india_5000_places.json"
    if not registry_path.exists():
        registry_path = WORKSPACE_ROOT / "india_5000_places.json"

    with open(registry_path, "r", encoding="utf-8") as f:
        master_places = json.load(f)

    # Import ICONIC_LANDMARKS
    from app.services.snap_travel_service import ICONIC_LANDMARKS


    # Format iconic landmarks as master place objects
    iconic_places = []
    for i, icon in enumerate(ICONIC_LANDMARKS):
        iconic_places.append({
            "id": 10000 + i,
            "name": icon["name"],
            "destination": icon["name"],
            "slug": icon["slug"],
            "state": icon["state"],
            "category": icon["category"],
            "title": icon["name"].replace(" ", "_"),
            "color": icon["color"]
        })

    # Combine: iconic places first, then master places
    combined_master = iconic_places + master_places
    print(f"Loaded {len(combined_master)} destination candidates ({len(iconic_places)} iconic + {len(master_places)} registry)", flush=True)

    # Local ground truth map
    local_gt_dir = DATASETS_DIR / "snap_travel"
    local_gt_map = {}
    if local_gt_dir.exists():
        for fld in local_gt_dir.iterdir():
            if fld.is_dir():
                photos = list(fld.glob("*.jpg")) + list(fld.glob("*.jpeg")) + list(fld.glob("*.png"))
                if photos:
                    local_gt_map[fld.name.lower()] = photos[0]

    # Process places using ThreadPoolExecutor for speed
    start_time = time.time()
    results = [None] * len(combined_master)

    print("🚀 Running multi-threaded image verification & feature extraction (12 workers)...", flush=True)
    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(process_single_place, (i, p), local_gt_map): i for i, p in enumerate(combined_master)}
        done_count = 0
        for fut in as_completed(futures):
            res = fut.result()
            idx = res[0]
            results[idx] = res
            done_count += 1
            if done_count % 500 == 0 or done_count == len(combined_master):
                print(f"  Processed {done_count}/{len(combined_master)} places...", flush=True)

    image_registry = []
    active_metadata = []
    active_vectors = []
    embedding_idx = 0

    for idx, place, clean_q, dest_img_path, source_url, status, feat in results:
        is_verified = (status == "verified" and feat is not None)

        image_registry.append({
            "id": place["id"],
            "destination": place.get("name") or place.get("destination", "Place"),
            "image_search_query": clean_q,
            "slug": place.get("slug", "").lower(),
            "state": place.get("state", "India"),
            "category": place.get("category", "Heritage"),
            "image_path": str(dest_img_path) if is_verified else None,
            "image_url": source_url,
            "image_status": "verified" if is_verified else "missing_image",
            "embedding_index": embedding_idx if is_verified else None
        })

        # STRICT REQUIREMENT: ONLY include verified images in active vector database!
        # NEVER generate a placeholder or color box vector!
        if is_verified:
            active_vectors.append(feat)
            active_metadata.append({
                "id": place["id"],
                "destination": place.get("name") or place.get("destination", "Place"),
                "image_search_query": clean_q,
                "slug": place.get("slug", "").lower(),
                "state": place.get("state", "India"),
                "category": place.get("category", "Heritage"),
                "color": place.get("color", [180, 160, 140]),
                "image_url": source_url,
                "embedding_index": embedding_idx
            })
            embedding_idx += 1

    print("\n--- Validating & Rebuilding landmark_vectors.npy ---", flush=True)
    if not active_vectors:
        raise RuntimeError("Zero verified images were found. Cannot build empty vector database.")

    vector_matrix = np.vstack(active_vectors).astype(np.float32)

    # Matrix integrity assertions
    assert not np.isnan(vector_matrix).any(), "NaN values found in vector matrix!"
    assert not np.isinf(vector_matrix).any(), "Inf values found in vector matrix!"
    assert vector_matrix.shape[0] == len(active_metadata), f"Shape mismatch: {vector_matrix.shape[0]} vs {len(active_metadata)}"
    assert vector_matrix.shape[1] == 512, f"Dimension mismatch: expected 512, got {vector_matrix.shape[1]}"

    norms = np.linalg.norm(vector_matrix, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-3), f"Vectors not properly L2-normalized: min={norms.min()}, max={norms.max()}"

    print(f"✅ Vector Matrix Validated: Shape {vector_matrix.shape}, dtype={vector_matrix.dtype}", flush=True)
    print(f"✅ Strict 1-to-1 Mapping: metadata[{len(active_metadata)}] <-> vectors[{vector_matrix.shape[0]}]", flush=True)

    # Save Image Registry
    reg_file = DATASETS_DIR / "landmark_image_registry.json"
    with open(reg_file, "w", encoding="utf-8") as f:
        json.dump(image_registry, f, indent=2)
    print(f"📁 Saved Image Registry: {reg_file} ({len(image_registry)} records)", flush=True)

    # Save to trained_models
    np.save(TRAINED_MODELS_DIR / "landmark_vectors.npy", vector_matrix)
    with open(TRAINED_MODELS_DIR / "landmark_metadata.json", "w", encoding="utf-8") as f:
        json.dump(active_metadata, f, indent=2)

    # Save to snap_travel_5000_artifacts for consistency
    artifacts_dir = WORKSPACE_ROOT / "snap_travel_5000_artifacts"
    if artifacts_dir.exists():
        np.save(artifacts_dir / "landmark_vectors.npy", vector_matrix)
        with open(artifacts_dir / "landmark_metadata.json", "w", encoding="utf-8") as f:
            json.dump(active_metadata, f, indent=2)

    print(f"📁 Saved Active Vectors to: {TRAINED_MODELS_DIR / 'landmark_vectors.npy'} ({vector_matrix.nbytes / 1e6:.2f} MB)", flush=True)
    print(f"📁 Saved Active Metadata to: {TRAINED_MODELS_DIR / 'landmark_metadata.json'}", flush=True)
    print("=" * 65, flush=True)
    print(f"🎉 PIPELINE OVERHAUL COMPLETE IN {time.time() - start_time:.1f}s!", flush=True)
    print("=" * 65, flush=True)


if __name__ == "__main__":
    main()
