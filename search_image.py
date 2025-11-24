import io
import json
import os
import pickle
from pathlib import Path

import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input
from tensorflow.keras.preprocessing import image

# Flask App
app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)


# (Tuỳ chọn) phục vụ trang static làm homepage
@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


# Phục vụ ảnh trong thư mục dataset/
@app.route("/dataset/<path:filename>")
def serve_dataset_image(filename):
    return send_from_directory("dataset", filename)


# Model & Data
# Tải model EfficientNetB0 (RGB 3 kênh)
model = EfficientNetB0(
    weights="imagenet", include_top=False, pooling="avg", input_shape=(224, 224, 3)
)

# Load vectors & paths
with open("vectors.pkl", "rb") as f:
    vectors = pickle.load(f)
with open("paths.pkl", "rb") as f:
    paths = pickle.load(f)

vectors = np.asarray(vectors, dtype=np.float32)
if vectors.ndim != 2:
    raise RuntimeError("vectors.pkl không đúng dạng (N, D).")


# Helpers
def image_preprocessing(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB").resize((224, 224))
    x = image.img_to_array(img)
    x = np.expand_dims(x, axis=0).astype("float32")
    x = preprocess_input(x)
    return x


def extract_vector(img_bytes: bytes) -> np.ndarray:
    """Trích đặc trưng + chuẩn hoá L2 (có eps)."""
    tensor = image_preprocessing(img_bytes)
    vec = model.predict(tensor, verbose=0)[0]
    norm = np.linalg.norm(vec)
    if norm < 1e-12:
        return vec.astype("float32")
    return (vec / norm).astype("float32")


# Metadata
BASE_DIR = Path(__file__).resolve().parent
METADATA_PATH = BASE_DIR / "metadata.json"
with open(METADATA_PATH, "r", encoding="utf-8") as f:
    DISH_METADATA = json.load(f)


def lookup_dish_meta(rel_path: str) -> dict:
    dish_id = rel_path.split("/", 1)[0]
    meta = DISH_METADATA.get(dish_id, {})
    return {
        "dish_id": dish_id,
        "name": meta.get("name"),
        "intro": meta.get("intro", "Chưa có mô tả."),
        "ingredients": meta.get("ingredients", []),
        "step": meta.get("step", []),
    }


# Ngưỡng khoảng cách: nếu ảnh gần nhất > THRESHOLD thì coi như không match
THRESHOLD = 0.9


@app.route("/search", methods=["POST"])
def search():
    if "image" not in request.files:
        return jsonify({"error": "no image uploaded"}), 400

    file = request.files["image"]
    filename = (file.filename or "").lower().strip()
    valid_ext = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
    if not filename.endswith(valid_ext):
        return jsonify({"error": "invalid image file type"}), 400

    img_bytes = file.read()
    if not img_bytes:
        return jsonify({"error": "empty file"}), 400

    try:
        query_vector = extract_vector(img_bytes)

        # Euclidean distance
        distances = np.linalg.norm(vectors - query_vector, axis=1)

        if distances.size == 0:
            # Không có vector nào trong DB
            return jsonify(
                {
                    "meta": None,
                    "results": [],
                    "message": "Không có dữ liệu trong cơ sở dữ liệu.",
                }
            )

        # Lấy index sắp xếp tăng dần theo distance
        idx_sorted = np.argsort(distances)

        # best distance (nhỏ nhất)
        best_idx = int(idx_sorted[0])
        best_dist = float(distances[best_idx])

        # Nếu khoảng cách tốt nhất vẫn > 1.0 => coi như không tìm thấy
        if best_dist > THRESHOLD:
            return jsonify(
                {
                    "meta": None,
                    "results": [],
                    "message": f"Không tìm thấy dữ liệu phù hợp (distance > {THRESHOLD}).",
                }
            )

        # Ngược lại: trả top K kết quả
        K = 50
        ids = idx_sorted[:K]

        results = [
            {
                "path": paths[i],
                "distance": float(distances[i]),
            }
            for i in ids
        ]

        best_meta = lookup_dish_meta(paths[best_idx]) if len(ids) > 0 else None

        return jsonify(
            {
                "meta": best_meta,
                "results": results,
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Run (local)
if __name__ == "__main__":
    # Render sẽ đặt biến PORT; local mặc định 5000
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, threaded=True, use_reloader=False)
