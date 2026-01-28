import json
import os
import pickle
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Tắt log thừa
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

from tensorflow.keras.applications.efficientnet import (
    EfficientNetB0,
    preprocess_input as cnn_preprocess,
)
from tensorflow.keras.preprocessing import image as keras_image
from transformers import ViTImageProcessor, ViTModel

# config
SIMILARITY_THRESHOLD = 0.9
TOP_K = 10
INPUT_SHAPE_CNN = (224, 224)

app = Flask(__name__, static_folder="static")
CORS(app)

# load model
print("--- LOADING MODELS ---")
print("1. CNN (EfficientNetB0)...")
cnn_model = EfficientNetB0(
    weights="imagenet", include_top=False, pooling="avg", input_shape=(224, 224, 3)
)

print("2. ViT (Vision Transformer)...")
VIT_NAME = "google/vit-base-patch16-224"
vit_processor = ViTImageProcessor.from_pretrained(VIT_NAME)
vit_model = ViTModel.from_pretrained(VIT_NAME)
vit_model.eval()

# load dataset
print("--- LOADING DATASET ---")
BASE_DIR = Path(__file__).resolve().parent

vectors_db = {"cnn": np.array([]), "vit": np.array([])}
paths = []
DISH_METADATA = {}

try:
    if (BASE_DIR / "paths.pkl").exists():
        with open(BASE_DIR / "paths.pkl", "rb") as f:
            paths = pickle.load(f)

    if (BASE_DIR / "metadata.json").exists():
        with open(BASE_DIR / "metadata.json", "r", encoding="utf-8") as f:
            DISH_METADATA = json.load(f)

    # Load Vectors
    for model_name, file_name in [("cnn", "vectors.pkl"), ("vit", "vectors_vit.pkl")]:
        p = BASE_DIR / file_name
        if p.exists():
            with open(p, "rb") as f:
                vectors_db[model_name] = pickle.load(f)
            vectors_db[model_name] = np.asarray(
                vectors_db[model_name], dtype=np.float32
            )

            # Chuẩn hóa L2 ngay khi load
            if vectors_db[model_name].size > 0:
                norm = np.linalg.norm(vectors_db[model_name], axis=1, keepdims=True)
                vectors_db[model_name] = vectors_db[model_name] / (norm + 1e-12)
                print(
                    f" -> {model_name.upper()} DB: {len(vectors_db[model_name])} vectors."
                )
        else:
            print(f" -> Warning: Missing {file_name}")

except Exception as e:
    print(f"Error loading data: {e}")


# helper function
def get_folder_name(path_str):
    return path_str.replace("\\", "/").split("/")[0]


def lookup_meta(path):
    dish_id = get_folder_name(path)
    return DISH_METADATA.get(
        dish_id, {"name": dish_id, "intro": "", "ingredients": [], "step": []}
    )


def process_cnn(img):
    img_resized = img.resize(INPUT_SHAPE_CNN)
    x = keras_image.img_to_array(img_resized)
    x = np.expand_dims(x, axis=0).astype("float32")
    x = cnn_preprocess(x)
    vec = cnn_model(x, training=False).numpy()[0]
    return vec / (np.linalg.norm(vec) + 1e-12)


def process_vit(img):
    inputs = vit_processor(images=img, return_tensors="pt")
    with torch.no_grad():
        outputs = vit_model(**inputs)
    vec = outputs.last_hidden_state[:, 0, :].numpy()[0]
    return vec / (np.linalg.norm(vec) + 1e-12)


def search_engine(query_vec, db_vecs, top_k=10):
    if db_vecs.size == 0:
        return []
    # Cosine Similarity
    sims = np.dot(db_vecs, query_vec)
    # Ranking
    indices = np.argsort(sims)[::-1][:top_k]

    results = []
    for idx in indices:
        score = float(sims[idx])
        results.append(
            {
                "path": paths[idx],
                "score": round(score, 4),
                "folder": get_folder_name(paths[idx]),
            }
        )
    return results


# routes
@app.route("/")
def home():
    return send_from_directory("static", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


@app.route("/dataset/<path:filename>")
def serve_dataset(filename):
    return send_from_directory(BASE_DIR / "dataset", filename)


@app.route("/search", methods=["POST"])
def search():
    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400

    file = request.files["image"]
    try:
        img = Image.open(file).convert("RGB")

        # chạy cnn
        vec_cnn = process_cnn(img)
        res_cnn = search_engine(vec_cnn, vectors_db["cnn"], TOP_K)

        # chạy vit
        vec_vit = process_vit(img)
        res_vit = search_engine(vec_vit, vectors_db["vit"], TOP_K)

        # lấy metadata
        best_meta = None
        if res_cnn:
            best_meta = lookup_meta(res_cnn[0]["path"])

        return jsonify({"meta": best_meta, "results": {"cnn": res_cnn, "vit": res_vit}})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860)
