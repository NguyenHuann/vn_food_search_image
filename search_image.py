import io
import json
import os
import pickle
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# TensorFlow logs optimization
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input
from tensorflow.keras.preprocessing import image

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

# CONFIG
THRESHOLD = 0.9
TOP_K = 50
INPUT_SHAPE = (224, 224)

# MODEL & DATA
print("Loading Model...")
model = EfficientNetB0(
    weights="imagenet", include_top=False, pooling="avg", input_shape=(224, 224, 3)
)

print("Loading Database...")
BASE_DIR = Path(__file__).resolve().parent

try:
    with open(BASE_DIR / "vectors.pkl", "rb") as f:
        vectors = pickle.load(f)
    with open(BASE_DIR / "paths.pkl", "rb") as f:
        paths = pickle.load(f)
    with open(BASE_DIR / "metadata.json", "r", encoding="utf-8") as f:
        DISH_METADATA = json.load(f)

    vectors = np.asarray(vectors, dtype=np.float32)

    # TỰ ĐỘNG CHUẨN HÓA DATABASE (Quan trọng để Euclidean distance chính xác)
    # Nếu vectors đã chuẩn hóa rồi thì bước này chạy rất nhanh, không sao cả.
    norm_db = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / (norm_db + 1e-12)

    print(f"Loaded {len(vectors)} vectors.")

except FileNotFoundError as e:
    print(f"Error loading data files: {e}")
    vectors = np.array([])
    paths = []
    DISH_METADATA = {}


# HELPERS
def process_image_to_vector(img_bytes: bytes) -> np.ndarray:
    """Xử lý ảnh và trích xuất vector (đã tối ưu tốc độ)"""
    try:
        # Mở ảnh và convert RGB ngay để tránh lỗi ảnh PNG 4 kênh (RGBA)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img = img.resize(INPUT_SHAPE)

        x = image.img_to_array(img)
        x = np.expand_dims(x, axis=0).astype("float32")
        x = preprocess_input(x)

        # Dùng model(x) nhanh hơn model.predict(x) cho single inference
        vec = model(x, training=False).numpy()[0]

        # L2 Normalize vector query
        norm = np.linalg.norm(vec)
        if norm < 1e-12:
            return vec
        return vec / norm

    except UnidentifiedImageError:
        raise ValueError("File tải lên không phải là ảnh hợp lệ.")
    except Exception as e:
        raise RuntimeError(f"Lỗi xử lý ảnh: {str(e)}")


def lookup_dish_meta(rel_path: str) -> dict:
    # Lấy ID món ăn từ tên folder (ví dụ: dish_001/image.jpg -> dish_001)
    parts = rel_path.split("/")
    # Xử lý trường hợp path dính dấu \ trên Windows
    if len(parts) == 1:
        parts = rel_path.split("\\")

    dish_id = parts[0] if parts else ""
    meta = DISH_METADATA.get(dish_id, {})

    return {
        "dish_id": dish_id,
        "name": meta.get("name", "Unknown"),
        "intro": meta.get("intro", "Chưa có mô tả."),
        "ingredients": meta.get("ingredients", []),
        "step": meta.get("step", []),
    }


# ROUTES
@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/dataset/<path:filename>")
def serve_dataset_image(filename):
    return send_from_directory(BASE_DIR / "dataset", filename)


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
            return jsonify({"error": "Database is empty"}), 500

        # Tính khoảng cách Euclidean: Vectorization (nhanh với numpy)
        # axis=1 để tính norm theo từng hàng
        distances = np.linalg.norm(vectors - query_vector, axis=1)

        # Lấy Top K index có khoảng cách nhỏ nhất
        # partition nhanh hơn sort toàn bộ mảng (O(n) vs O(n log n))
        if len(distances) > TOP_K:
            nearest_indices = np.argpartition(distances, TOP_K)[:TOP_K]
            # Sau khi partition, cần sort lại tập con nhỏ này để đúng thứ tự
            nearest_indices = nearest_indices[np.argsort(distances[nearest_indices])]
        else:
            nearest_indices = np.argsort(distances)

        # Kiểm tra kết quả tốt nhất
        best_idx = nearest_indices[0]
        best_dist = distances[best_idx]

        if best_dist > THRESHOLD:
            return jsonify(
                {
                    "meta": None,
                    "results": [],
                    "message": f"Không tìm thấy ảnh giống (Distance: {best_dist:.2f} > {THRESHOLD})",
                }
            )

        # Format kết quả trả về
        results = []
        for i in nearest_indices:
            results.append({"path": paths[i], "distance": float(distances[i])})

        best_meta = lookup_dish_meta(paths[best_idx])

        return jsonify(
            {"meta": best_meta, "results": results, "best_match_dist": float(best_dist)}
        )

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        print(f"Server Error: {e}")  # Log lỗi ra console server
        return jsonify({"error": "Internal Server Error"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, threaded=True, use_reloader=False)
