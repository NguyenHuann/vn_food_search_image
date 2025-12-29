import io
import json
import os
import pickle
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Tắt log thừa của TensorFlow để console gọn hơn
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input
from tensorflow.keras.preprocessing import image

# CONFIG
THRESHOLD = 0.9  # Ngưỡng chấp nhận
TOP_K = 100  # Số lượng ảnh tối đa để xem xét
INPUT_SHAPE = (224, 224)

# APP SETUP
app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

# LOAD MODEL
print(">>> Loading EfficientNetB0 model...")
# pooling='avg' giúp lấy vector đặc trưng thay vì feature map
model = EfficientNetB0(
    weights="imagenet", include_top=False, pooling="avg", input_shape=(224, 224, 3)
)

# LOAD DATABASE
print(">>> Loading Database (Vectors & Metadata)...")
BASE_DIR = Path(__file__).resolve().parent

# Khởi tạo biến toàn cục
vectors = np.array([])
paths = []
DISH_METADATA = {}

try:
    # Load Vectors
    with open(BASE_DIR / "vectors.pkl", "rb") as f:
        vectors = pickle.load(f)
    vectors = np.asarray(vectors, dtype=np.float32)

    # Load Paths
    with open(BASE_DIR / "paths.pkl", "rb") as f:
        paths = pickle.load(f)

    # Load Metadata
    meta_path = BASE_DIR / "metadata.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            DISH_METADATA = json.load(f)
    else:
        print("Warning: metadata.json not found.")

    # Chuẩn hóa L2 cho Database ngay khi load
    # Giúp tính toán Euclidean Distance chính xác
    if vectors.size > 0:
        norm_db = np.linalg.norm(vectors, axis=1, keepdims=True)
        # Cộng 1e-12 để tránh chia cho 0
        vectors = vectors / (norm_db + 1e-12)
        print(f">>> Database loaded successfully: {len(vectors)} items.")
    else:
        print(">>> Database is empty.")

except FileNotFoundError as e:
    print(f"Error loading database files: {e}")
    print("Please make sure vectors.pkl and paths.pkl exist.")


# HELPER FUNCTIONS


def process_image_to_vector(img_bytes: bytes) -> np.ndarray:
    # Đọc bytes, resize, preprocess và trích xuất vector.
    try:
        # Convert RGB để xử lý cả ảnh PNG trong suốt hoặc Grayscale
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img = img.resize(INPUT_SHAPE)

        x = image.img_to_array(img)
        x = np.expand_dims(x, axis=0).astype("float32")
        x = preprocess_input(x)

        # Inference: training=False để tắt Dropout/BatchNormal update
        vec = model(x, training=False).numpy()[0]

        # Chuẩn hóa L2 cho vector truy vấn
        norm = np.linalg.norm(vec)
        if norm < 1e-12:
            return vec
        return vec / norm

    except UnidentifiedImageError:
        raise ValueError("File is not a valid image.")
    except Exception as e:
        raise RuntimeError(f"Error processing image: {str(e)}")


def get_folder_name(path_str: str) -> str:
    normalized = path_str.replace("\\", "/")
    parts = normalized.split("/")
    return parts[0] if parts else ""


def lookup_dish_meta(rel_path: str) -> dict:
    """Tra cứu thông tin món ăn dựa trên đường dẫn ảnh."""
    dish_id = get_folder_name(rel_path)
    meta = DISH_METADATA.get(dish_id, {})

    return {
        "dish_id": dish_id,
        "name": meta.get("name", "Unknown Dish"),
        "intro": meta.get("intro", ""),
        "ingredients": meta.get("ingredients", []),
        "step": meta.get("step", []),
    }


# ROUTES


@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/dataset/<path:filename>")
def serve_dataset_image(filename):
    """Phục vụ file ảnh từ thư mục dataset"""
    return send_from_directory(BASE_DIR / "dataset", filename)


@app.route("/search", methods=["POST"])
def search():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "No selected file"}), 400

    try:
        # 1. Trích xuất vector từ ảnh upload
        img_bytes = file.read()
        query_vector = process_image_to_vector(img_bytes)

        if vectors.size == 0:
            return jsonify({"error": "Database is empty"}), 500

        # 2. Tính khoảng cách Euclidean
        # (vectors - query) -> bình phương -> tổng -> căn bậc 2
        distances = np.linalg.norm(vectors - query_vector, axis=1)

        # 3. Lấy Top K index có khoảng cách nhỏ nhất
        # np.argpartition nhanh hơn sort toàn bộ mảng
        k = min(TOP_K, len(distances))
        if len(distances) > k:
            unsorted_top_k = np.argpartition(distances, k)[:k]
            # Sort lại tập con nhỏ này
            nearest_indices = unsorted_top_k[np.argsort(distances[unsorted_top_k])]
        else:
            nearest_indices = np.argsort(distances)

        # 4. Kiểm tra kết quả tốt nhất (Top 1)
        best_idx = nearest_indices[0]
        best_dist = float(distances[best_idx])

        # Nếu ảnh giống nhất mà vẫn xa hơn ngưỡng -> Không tìm thấy
        if best_dist > THRESHOLD:
            return jsonify(
                {
                    "meta": None,
                    "results": {"same_dish": [], "related": []},
                    "message": f"No match found (Distance {best_dist:.2f} > {THRESHOLD})",
                }
            )

        # 5. Phân loại kết quả (Same Dish vs Related)
        best_path = paths[best_idx]
        best_folder = get_folder_name(best_path)  # Đây là thư mục "gốc" (Label dự đoán)

        same_dish_results = []
        related_results = []

        for i in nearest_indices:
            current_path = paths[i]
            current_dist = float(distances[i])
            current_folder = get_folder_name(current_path)

            item = {
                "path": current_path,
                "distance": current_dist,
                "folder": current_folder,
            }

            if current_folder == best_folder:
                same_dish_results.append(item)
            else:
                related_results.append(item)

        # 6. Lấy metadata của món ăn dự đoán
        best_meta = lookup_dish_meta(best_path)

        return jsonify(
            {
                "meta": best_meta,
                "results": {
                    "same_dish": same_dish_results,  # List ảnh cùng thư mục với Top 1
                    "related": related_results,  # List ảnh khác thư mục
                },
                "best_match_dist": best_dist,
            }
        )

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # Log lỗi ra terminal server để debug
        print(f"!!! Server Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# --- RUN APP ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # use_reloader=False để tránh load model 2 lần khi debug local
    app.run(host="0.0.0.0", port=port, threaded=True, use_reloader=False)
