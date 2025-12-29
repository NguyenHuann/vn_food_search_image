import io
import json
import os
import pickle
from pathlib import Path

import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Tắt log thừa của TensorFlow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input
from tensorflow.keras.preprocessing import image

# --- CONFIG ---
THRESHOLD = 0.9
TOP_K = 100
INPUT_SHAPE = (224, 224)

# --- APP SETUP ---
# static_folder='static' nghĩa là mọi file HTML, CSS, JS để trong thư mục static
app = Flask(__name__, static_folder="static")
CORS(app)

# --- LOAD MODEL ---
print(">>> Loading EfficientNetB0 model...")
model = EfficientNetB0(
    weights="imagenet", include_top=False, pooling="avg", input_shape=(224, 224, 3)
)

# --- LOAD DATABASE ---
print(">>> Loading Database...")
BASE_DIR = Path(__file__).resolve().parent

vectors = np.array([])
paths = []
DISH_METADATA = {}

try:
    with open(BASE_DIR / "vectors.pkl", "rb") as f:
        vectors = pickle.load(f)
    vectors = np.asarray(vectors, dtype=np.float32)

    with open(BASE_DIR / "paths.pkl", "rb") as f:
        paths = pickle.load(f)

    meta_path = BASE_DIR / "metadata.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            DISH_METADATA = json.load(f)

    # Chuẩn hóa Database
    if vectors.size > 0:
        norm_db = np.linalg.norm(vectors, axis=1, keepdims=True)
        vectors = vectors / (norm_db + 1e-12)
        print(f">>> DB Loaded: {len(vectors)} items.")
    else:
        print(">>> Database is empty.")

except Exception as e:
    print(f"Error loading DB: {e}")


# --- HELPER FUNCTIONS ---
def process_image_to_vector(img_bytes: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img = img.resize(INPUT_SHAPE)
        x = image.img_to_array(img)
        x = np.expand_dims(x, axis=0).astype("float32")
        x = preprocess_input(x)

        vec = model(x, training=False).numpy()[0]
        norm = np.linalg.norm(vec)
        return vec if norm < 1e-12 else vec / norm
    except Exception as e:
        raise RuntimeError(f"Img Error: {str(e)}")


def get_folder_name(path_str: str) -> str:
    normalized = path_str.replace("\\", "/")
    parts = normalized.split("/")
    return parts[0] if parts else ""


def lookup_dish_meta(rel_path: str) -> dict:
    dish_id = get_folder_name(rel_path)
    meta = DISH_METADATA.get(dish_id, {})
    return {
        "dish_id": dish_id,
        "name": meta.get("name", "Unknown Dish"),
        "intro": meta.get("intro", ""),
        "ingredients": meta.get("ingredients", []),
        "step": meta.get("step", []),
    }


# --- ROUTES ---


# 1. Route trang chủ
@app.route("/")
def home():
    return send_from_directory("static", "index.html")


# 2. Route phục vụ CSS, JS, Ảnh trong folder static
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


# 3. Route phục vụ dataset ảnh
@app.route("/dataset/<path:filename>")
def serve_dataset_image(filename):
    return send_from_directory(BASE_DIR / "dataset", filename)


# 4. API Search
@app.route("/search", methods=["POST"])
def search():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "No selected file"}), 400

    try:
        img_bytes = file.read()
        query_vector = process_image_to_vector(img_bytes)

        if vectors.size == 0:
            return jsonify({"error": "Empty DB"}), 500

        distances = np.linalg.norm(vectors - query_vector, axis=1)

        k = min(TOP_K, len(distances))
        if len(distances) > k:
            unsorted = np.argpartition(distances, k)[:k]
            nearest_indices = unsorted[np.argsort(distances[unsorted])]
        else:
            nearest_indices = np.argsort(distances)

        best_idx = nearest_indices[0]
        best_dist = float(distances[best_idx])

        if best_dist > THRESHOLD:
            return jsonify({"meta": None, "results": {"same_dish": [], "related": []}})

        best_path = paths[best_idx]
        best_folder = get_folder_name(best_path)

        same_dish = []
        related = []

        for i in nearest_indices:
            path = paths[i]
            dist = float(distances[i])
            folder = get_folder_name(path)

            # Logic: Món nào có cùng folder với Top 1 thì vào Same Dish
            # Các món còn lại vào Related
            item = {"path": path, "distance": dist, "folder": folder}
            if folder == best_folder:
                same_dish.append(item)
            else:
                related.append(item)

        best_meta = lookup_dish_meta(best_path)

        return jsonify(
            {"meta": best_meta, "results": {"same_dish": same_dish, "related": related}}
        )

    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"error": str(e)}), 500


# --- RUN APP ---
if __name__ == "__main__":
    # Hugging Face Spaces mặc định chạy port 7860
    app.run(host="0.0.0.0", port=7860)
