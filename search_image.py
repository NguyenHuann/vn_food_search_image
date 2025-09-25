import os
import io
import pickle
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input
from tensorflow.keras.preprocessing import image
import json
from pathlib import Path


# Khởi tạo Flask app sớm
app = Flask(__name__, static_folder="dataset", static_url_path="/dataset")
CORS(app)
# Load model
model = EfficientNetB0(
    weights="imagenet", include_top=False, pooling="avg", input_shape=(224, 224, 3)
)

# Load vector và path ảnh đã lưu
vectors = pickle.load(open("vectors.pkl", "rb"))
paths = pickle.load(open("paths.pkl", "rb"))
vectors = np.array(vectors)


# Tiền xử lý ảnh
def image_preprocessing(file_bytes):
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB").resize((224, 224))
    x = image.img_to_array(img)
    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)
    return x


# Trích xuất vector đặc trưng
def extract_vector(img_bytes):
    tensor = image_preprocessing(img_bytes)
    vector = model.predict(tensor)[0]
    return vector / np.linalg.norm(vector)


# Route tìm kiếm
@app.route("/search", methods=["POST"])
def search():
    if "image" not in request.files:
        return jsonify({"error": "no image uploaded"}), 400

    file = request.files["image"]
    filename = file.filename.lower().strip()
    valid_ext = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

    if not filename.endswith(valid_ext):
        return jsonify({"error": "invalid image file type"}), 400

    img_bytes = file.read()

    try:
        query_vector = extract_vector(img_bytes)
        distances = np.linalg.norm(vectors - query_vector, axis=1)
        ids = np.argsort(distances)[:24]

        results = [
            {
                "path": paths[i],
                "distance": float(distances[i]),
            }
            for i in ids
        ]
        best_meta = lookup_dish_meta(paths[ids[0]])
        return jsonify(
            {
                "meta": best_meta,
                "results": results,
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


BASE_DIR = Path(__file__).resolve().parent
METADATA_PATH = BASE_DIR / "metadata.json"

# load metadata
with open(METADATA_PATH, "r", encoding="utf-8") as f:
    DISH_METADATA = json.load(f)


def lookup_dish_meta(rel_path: str) -> dict:
    dish_id = rel_path.split("/", 1)[0]
    meta = DISH_METADATA.get(dish_id, {})
    return {
        "dish_id": dish_id,
        "name": meta.get("name"),
        "intro": meta.get("intro", "Chưa có mô tả."),
        "ingredients": meta.get("ingredients", "unknown"),
        "step": meta.get("step", "unknown"),
    }


# Chạy server
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True, use_reloader=False)
