import os
import pickle

import numpy as np
from PIL import Image

# Tắt log thừa của TensorFlow
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

from tensorflow.keras.applications.efficientnet import (
    EfficientNetB0,
    preprocess_input as cnn_preprocess,
)
from tensorflow.keras.preprocessing import image

from transformers import ViTImageProcessor, ViTModel

# cấu hình
DATASET_DIR = "dataset"
VALID_EXT = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
VIT_MODEL_NAME = "google/vit-base-patch16-224"

# load model cnn
print("Đang tải model EfficientNetB0 (CNN)...")
cnn_model = EfficientNetB0(weights="imagenet", include_top=False, pooling="avg")

# load model vit
print("Đang tải model Vision Transformer (ViT)...")
vit_processor = ViTImageProcessor.from_pretrained(VIT_MODEL_NAME)
vit_model = ViTModel.from_pretrained(VIT_MODEL_NAME)


# hàm xử lý


def get_cnn_vector(img):
    """Trích xuất đặc trưng bằng EfficientNetB0"""
    # Resize và tiền xử lý theo chuẩn Keras
    img_resized = img.resize((224, 224))
    x = image.img_to_array(img_resized)
    x = np.expand_dims(x, axis=0)
    x = cnn_preprocess(x)

    vector = cnn_model.predict(x, verbose=0)[0]
    # Chuẩn hóa L2
    norm = np.linalg.norm(vector)
    return vector / (norm + 1e-12)


import torch


def get_vit_vector(img):
    """Trích xuất đặc trưng bằng Vision Transformer (PyTorch)"""
    inputs = vit_processor(images=img, return_tensors="pt")
    with torch.no_grad():
        outputs = vit_model(**inputs)

    # .detach().numpy() dùng để ngắt kết nối khỏi đồ thị tính toán và chuyển về NumPy
    vector = outputs.last_hidden_state[:, 0, :].detach().numpy()[0]

    # chuẩn hóa L2
    norm = np.linalg.norm(vector)
    return vector / (norm + 1e-12)


# main

vectors_cnn: list[np.ndarray] = []
vectors_vit: list[np.ndarray] = []
paths: list[str] = []

print(f"Bắt đầu quét thư mục '{DATASET_DIR}'...")

for root, _, files in os.walk(DATASET_DIR):
    # Sắp xếp file để đảm bảo thứ tự nhất quán
    for fname in sorted(files):
        if not fname.lower().endswith(VALID_EXT):
            continue

        image_path = os.path.join(root, fname)
        # Đường dẫn tương đối
        rel_path = os.path.relpath(image_path, start=DATASET_DIR).replace("\\", "/")

        try:
            # Mở ảnh 1 lần, convert RGB
            img = Image.open(image_path).convert("RGB")

            # lấy vector CNN
            vec_c = get_cnn_vector(img)

            # lấy vector ViT
            vec_v = get_vit_vector(img)

            # chỉ append khi cả 2 model đều thành công để đảm bảo đồng bộ index
            vectors_cnn.append(vec_c)
            vectors_vit.append(vec_v)
            paths.append(rel_path)

            if len(paths) % 100 == 0:
                print(f"Đã xử lý {len(paths)} ảnh...")

        except Exception as e:
            print(f"Lỗi xử lý ảnh: {image_path} | {e}")

# lưu dữ liệu

# lưu danh sách đường dẫn
pickle.dump(paths, open("paths.pkl", "wb"))

# lưu vector CNN
pickle.dump(vectors_cnn, open("vectors.pkl", "wb"))

# lưu vector ViT
pickle.dump(vectors_vit, open("vectors_vit.pkl", "wb"))

print("--- HOÀN TẤT ---")
print(f"Tổng số ảnh: {len(paths)}")
print(f"Saved: paths.pkl ({len(paths)} items)")
print(
    f"Saved: vectors.pkl (CNN shape: {len(vectors_cnn)}x{len(vectors_cnn[0]) if vectors_cnn else 0})"
)
print(
    f"Saved: vectors_vit.pkl (ViT shape: {len(vectors_vit)}x{len(vectors_vit[0]) if vectors_vit else 0})"
)
