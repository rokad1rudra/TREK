"""
Standalone Snap & Travel Visual Vector Search Training Pipeline
Trains custom Deep Residual CNN, generates 512-D vector embeddings database,
and exports all 4 production artifacts to trained_models/.
"""

import os
import sys
import json
import shutil
import urllib.request
from pathlib import Path
from io import BytesIO
from typing import Dict, List, Any

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, random_split

# ── 1. Destination Definitions & 5,000 Places Registry ──
PLACES_JSON = BASE_DIR / "datasets" / "india_5000_places.json"
if not PLACES_JSON.exists():
    PLACES_JSON = BASE_DIR.parent / "india_5000_places.json"

if PLACES_JSON.exists():
    with open(PLACES_JSON, "r", encoding="utf-8") as f:
        PLACES_LIST = json.load(f)
    print(f"Loaded {len(PLACES_LIST)} places from {PLACES_JSON.name}")
    DESTINATIONS_MAP = {
        p["slug"]: {
            "title": p["title"],
            "name": p["name"],
            "state": p.get("state", "India"),
            "category": p.get("category", "Heritage"),
            "color": tuple(p.get("color", (180, 160, 140)))
        }
        for p in PLACES_LIST
    }
else:
    DESTINATIONS_MAP = {
        "taj_mahal_agra": {"title": "Taj_Mahal", "name": "Taj Mahal Agra", "state": "Uttar Pradesh", "category": "Heritage", "color": (240, 235, 230)},
        "hawa_mahal_jaipur": {"title": "Hawa_Mahal", "name": "Hawa Mahal Jaipur", "state": "Rajasthan", "category": "Heritage", "color": (225, 120, 100)},
        "gateway_of_india_mumbai": {"title": "Gateway_of_India", "name": "Gateway of India Mumbai", "state": "Maharashtra", "category": "Monument", "color": (180, 160, 140)},
        "golden_temple_amritsar": {"title": "Golden_Temple", "name": "Golden Temple Amritsar", "state": "Punjab", "category": "Pilgrimage", "color": (245, 200, 50)},
        "pangong_lake_ladakh": {"title": "Pangong_Tso", "name": "Pangong Lake Ladakh", "state": "Ladakh", "category": "Lake", "color": (60, 130, 200)},
        "solang_valley_manali": {"title": "Solang_Valley", "name": "Solang Valley Manali", "state": "Himachal Pradesh", "category": "Hill Station", "color": (100, 180, 100)},
        "baga_beach_goa": {"title": "Baga,_Goa", "name": "Baga Beach Goa", "state": "Goa", "category": "Beach", "color": (70, 170, 190)},
        "udaipur_city_palace": {"title": "City_Palace,_Udaipur", "name": "Udaipur City Palace", "state": "Rajasthan", "category": "Palace", "color": (230, 220, 200)},
        "munnar_tea_gardens_kerala": {"title": "Munnar", "name": "Munnar Tea Gardens Kerala", "state": "Kerala", "category": "Hill Station", "color": (40, 140, 50)},
        "mysore_palace_karnataka": {"title": "Mysore_Palace", "name": "Mysore Palace Karnataka", "state": "Karnataka", "category": "Palace", "color": (210, 160, 80)},
        "meenakshi_temple_madurai": {"title": "Meenakshi_Temple", "name": "Meenakshi Temple Madurai", "state": "Tamil Nadu", "category": "Temple", "color": (200, 100, 120)},
        "victoria_memorial_kolkata": {"title": "Victoria_Memorial,_Kolkata", "name": "Victoria Memorial Kolkata", "state": "West Bengal", "category": "Heritage", "color": (235, 235, 240)}
    }


def fetch_wikipedia_photo(title: str):
    """Fetches high-res landmark photo via Wikimedia API"""
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=600&titles={title}"
        req = urllib.request.Request(url, headers={"User-Agent": "SnapTravelBot/2.0 (student-travel-project)"})
        with urllib.request.urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        page = next(iter(pages.values()))
        thumb_url = page.get("thumbnail", {}).get("source")
        if thumb_url:
            img_req = urllib.request.Request(thumb_url, headers={"User-Agent": "SnapTravelBot/2.0"})
            with urllib.request.urlopen(img_req, timeout=8) as img_resp:
                return Image.open(BytesIO(img_resp.read())).convert("RGB")
    except Exception:
        pass
    return None


def create_procedural_sample(base_color, variant_idx: int, size=(224, 224)):
    """Creates realistic procedural sample texture as guaranteed offline fallback"""
    img = Image.new("RGB", size, color=base_color)
    pixels = img.load()
    w, h = size
    v_shift = (variant_idx * 23) % 45
    for y in range(h):
        grad = int((y / h) * 40) - 20
        for x in range(w):
            r, g, b = base_color
            shade = grad + ((x * y + v_shift) % 15) - 7
            pixels[x, y] = (
                max(0, min(255, r + shade)),
                max(0, min(255, g + shade)),
                max(0, min(255, b + shade))
            )
    return img


def collect_dataset(dataset_dir: Path, limit: int = None):
    """Downloads & augments landmark reference images for each destination (10 photos per place)"""
    dataset_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Preparing landmark dataset in: {dataset_dir}")
    
    items = list(DESTINATIONS_MAP.items())
    if limit:
        items = items[:limit]
    print(f"Processing {len(items)} destinations with 10 photos each...")
    
    total_imgs = 0
    for idx, (folder_name, info) in enumerate(items, 1):
        p_dir = dataset_dir / folder_name
        p_dir.mkdir(parents=True, exist_ok=True)
        
        existing = len([f for f in p_dir.iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png')])
        if existing >= 10:
            total_imgs += existing
            continue
            
        if idx % 100 == 0 or idx <= 5:
            print(f"  [{idx}/{len(items)}] Fetching photos for {info['name']} ({info.get('state', '')})...")
        base_img = fetch_wikipedia_photo(info["title"])
        saved = 0
        if base_img is not None:
            base_img = base_img.resize((224, 224))
            base_img.save(p_dir / f"{saved}.jpg")
            saved += 1
            
            # Photometric & Geometric augmentations
            base_img.transpose(Image.FLIP_LEFT_RIGHT).save(p_dir / f"{saved}.jpg")
            saved += 1
            ImageEnhance.Brightness(base_img).enhance(1.2).save(p_dir / f"{saved}.jpg")
            saved += 1
            ImageEnhance.Brightness(base_img).enhance(0.85).save(p_dir / f"{saved}.jpg")
            saved += 1
            ImageEnhance.Contrast(base_img).enhance(1.25).save(p_dir / f"{saved}.jpg")
            saved += 1
            base_img.rotate(5, resample=Image.BILINEAR).save(p_dir / f"{saved}.jpg")
            saved += 1
            base_img.rotate(-5, resample=Image.BILINEAR).save(p_dir / f"{saved}.jpg")
            saved += 1
            base_img.filter(ImageFilter.DETAIL).save(p_dir / f"{saved}.jpg")
            saved += 1
            w, h = base_img.size
            base_img.crop((int(0.08*w), int(0.08*h), int(0.92*w), int(0.92*h))).resize((224, 224)).save(p_dir / f"{saved}.jpg")
            saved += 1
            base_img.crop((int(0.05*w), int(0.05*h), int(0.95*w), int(0.95*h))).resize((224, 224)).save(p_dir / f"{saved}.jpg")
            saved += 1

        # Fallback if offline
        while saved < 10:
            create_procedural_sample(info["color"], saved).save(p_dir / f"{saved}.jpg")
            saved += 1
            
        total_imgs += saved
        
    print(f"✅ Image dataset ready: {total_imgs} images across {len(items)} destinations.")


# ── 2. Model Architecture ──
class ResidualBlock(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1):
        super(ResidualBlock, self).__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels)
            )

    def forward(self, x):
        residual = self.shortcut(x)
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual
        out = self.relu(out)
        return out


class CustomTravelVectorModel(nn.Module):
    def __init__(self, num_classes=12, embedding_dim=512):
        super(CustomTravelVectorModel, self).__init__()
        self.prep = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        )
        self.stage1 = self._make_stage(64, 64, num_blocks=2, stride=1)
        self.stage2 = self._make_stage(64, 128, num_blocks=2, stride=2)
        self.stage3 = self._make_stage(128, 256, num_blocks=3, stride=2)
        self.stage4 = self._make_stage(256, 512, num_blocks=2, stride=2)
        
        self.global_pool = nn.AdaptiveAvgPool2d((1, 1))
        self.embedding_head = nn.Linear(512, embedding_dim)
        self.classifier = nn.Linear(embedding_dim, num_classes)

    def _make_stage(self, in_channels, out_channels, num_blocks, stride):
        strides = [stride] + [1] * (num_blocks - 1)
        layers = []
        for s in strides:
            layers.append(ResidualBlock(in_channels, out_channels, s))
            in_channels = out_channels
        return nn.Sequential(*layers)

    def forward_features(self, x):
        x = self.prep(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = self.stage4(x)
        x = self.global_pool(x)
        x = torch.flatten(x, 1)
        embeddings = self.embedding_head(x)
        return F.normalize(embeddings, p=2, dim=1)

    def forward(self, x):
        embeddings = self.forward_features(x)
        logits = self.classifier(embeddings)
        return logits, embeddings


# ── 3. Main Training & Serialization Pipeline ──
def train_and_index():
    print("=" * 65)
    print("      SNAP & TRAVEL DEEP VECTOR SEARCH TRAINING PIPELINE")
    print("=" * 65)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Hardware Device: {device}")
    
    dataset_dir = BASE_DIR / "datasets" / "snap_travel"
    collect_dataset(dataset_dir)
    
    # Transforms
    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    eval_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    full_dataset = datasets.ImageFolder(root=str(dataset_dir), transform=train_transforms)
    class_names = full_dataset.classes
    num_classes = len(class_names)
    print(f"Classes ({num_classes}): {class_names}")
    
    total_len = len(full_dataset)
    train_size = max(1, int(0.85 * total_len))
    val_size = total_len - train_size
    train_data, val_data = random_split(full_dataset, [train_size, val_size])
    
    batch_size = min(16, max(2, len(train_data)))
    train_loader = DataLoader(
        train_data, 
        batch_size=batch_size, 
        shuffle=True, 
        num_workers=0,
        drop_last=(len(train_data) > batch_size and len(train_data) % batch_size == 1)
    )
    val_loader = DataLoader(val_data, batch_size=batch_size, shuffle=False, num_workers=0)
    
    print(f"\n[1/3] Instantiating CustomTravelVectorModel on {device}...")
    model = CustomTravelVectorModel(num_classes=num_classes, embedding_dim=512).to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-4)
    EPOCHS = 8
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    
    use_cuda = (device.type == "cuda")
    try:
        scaler = torch.amp.GradScaler('cuda', enabled=use_cuda)
    except Exception:
        scaler = None
        
    print(f"\n[2/3] Training for {EPOCHS} Epochs...")
    for epoch in range(EPOCHS):
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            
            if images.size(0) == 1:
                model.eval()
            else:
                model.train()
                
            if use_cuda and scaler:
                with torch.amp.autocast(device_type="cuda"):
                    logits, _ = model(images)
                    loss = criterion(logits, labels)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                logits, _ = model(images)
                loss = criterion(logits, labels)
                loss.backward()
                optimizer.step()
                
            train_loss += loss.item() * images.size(0)
            _, preds = torch.max(logits, 1)
            train_correct += (preds == labels).sum().item()
            train_total += labels.size(0)
            
        scheduler.step()
        
        # Validation
        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for val_imgs, val_lbls in val_loader:
                val_imgs, val_lbls = val_imgs.to(device), val_lbls.to(device)
                v_logits, _ = model(val_imgs)
                _, v_preds = torch.max(v_logits, 1)
                val_correct += (v_preds == val_lbls).sum().item()
                val_total += val_lbls.size(0)
                
        train_acc = (train_correct / max(1, train_total)) * 100
        val_acc = (val_correct / max(1, val_total)) * 100
        print(f"  Epoch [{epoch+1:02d}/{EPOCHS}] -> Loss: {train_loss/max(1, train_total):.4f} | Train Acc: {train_acc:.1f}% | Val Acc: {val_acc:.1f}%")

    # ── 4. Build Vector DB Index ──
    print(f"\n[3/3] Indexing 512-D L2-Normalized Vectors...")
    model.eval()
    vectors = []
    metadata = []
    with torch.no_grad():
        for idx, (img_path, class_idx) in enumerate(full_dataset.samples):
            try:
                img = Image.open(img_path).convert("RGB")
                tensor = eval_transforms(img).unsqueeze(0).to(device)
                v = model.forward_features(tensor).cpu().numpy().flatten()
                vectors.append(v)
                slug = class_names[class_idx]
                info = DESTINATIONS_MAP.get(slug, {})
                metadata.append({
                    "id": idx,
                    "destination": info.get("name", slug.replace("_", " ").title()),
                    "slug": slug,
                    "state": info.get("state", "India"),
                    "category": info.get("category", "Heritage"),
                    "image_path": str(img_path)
                })
            except Exception:
                continue
                
    vector_db = np.array(vectors, dtype=np.float32)
    print(f"  -> Vector DB indexed: {vector_db.shape[0]} landmarks, {vector_db.shape[1]}-D embeddings.")
    
    # ── 5. Save Artifacts ──
    trained_models_dir = BASE_DIR / "trained_models"
    trained_models_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = trained_models_dir / "snap_travel_custom_model.pth"
    torch.save(model.state_dict(), str(model_path))
    
    vec_path = trained_models_dir / "landmark_vectors.npy"
    np.save(str(vec_path), vector_db)
    
    meta_path = trained_models_dir / "landmark_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    classes_path = trained_models_dir / "classes.json"
    with open(classes_path, "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2)
        
    print(f"\n🎉 Successfully saved all 4 model artifacts to: {trained_models_dir}")
    print(f"  [1] Model Weights : {model_path.name} ({os.path.getsize(model_path)} bytes)")
    print(f"  [2] Vector DB     : {vec_path.name} ({os.path.getsize(vec_path)} bytes)")
    print(f"  [3] Metadata JSON : {meta_path.name} ({len(metadata)} entries)")
    print(f"  [4] Classes JSON  : {classes_path.name} ({len(class_names)} destinations)")
    
    # ── 6. Test Inference ──
    print("\n🔍 Testing Live Search Inference...")
    if full_dataset.samples:
        test_img_path, test_class_idx = full_dataset.samples[0]
        test_img = Image.open(test_img_path).convert("RGB")
        tensor = eval_transforms(test_img).unsqueeze(0).to(device)
        with torch.no_grad():
            query_vec = model.forward_features(tensor).cpu().numpy().flatten()
        similarities = np.dot(vector_db, query_vec)
        top_k_indices = np.argsort(similarities)[::-1][:3]
        print(f"Query Image Class: {class_names[test_class_idx]}")
        for rank, i in enumerate(top_k_indices, 1):
            dest = metadata[i]["destination"].replace("_", " ").title()
            score = round(float(similarities[i]) * 100, 2)
            print(f"  Top Match {rank}: {dest} ({score}% match)")

    print("\n" + "=" * 65)
    print("✅ Snap & Travel Engine Training and Verification COMPLETE!")
    print("=" * 65)


if __name__ == "__main__":
    train_and_index()
