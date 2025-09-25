import os
import pickle
import numpy as np
from PIL import Image

from tensorflow.keras.applications.efficientnet import EfficientNetB0, preprocess_input
from tensorflow.keras.preprocessing import image

# Tạo model EfficientNetB0
model = EfficientNetB0(weights="imagenet", include_top=False, pooling="avg")


# Tiền xử lý ảnh
def image_preprocessing(img):
    img = img.resize((224, 224))
    img = img.convert("RGB")
    x = image.img_to_array(img)
    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)  # chuẩn hóa theo EfficientNet
    return x


# Trích xuất vector đặc trưng
def extract_vector(model, image_path):
    img = Image.open(image_path)
    tensor = image_preprocessing(img)
    vector = model.predict(tensor)[0]
    return vector / np.linalg.norm(vector)  # chuẩn hóa L2


# Lưu vector và đường dẫn ảnh
dataset_dir = "dataset"
valid_ext = (".jpg", ".jpeg", ".png", ".bmp", ".webp")

vectors: list[np.ndarray] = []
paths: list[str] = []

for root, _, files in os.walk(dataset_dir):
    # sắp xếp để kết quả tái lập
    for fname in sorted(files):
        if not fname.lower().endswith(valid_ext):
            continue

        image_path = os.path.join(root, fname)

        # lưu đường dẫn TƯƠNG ĐỐI bên trong 'dataset', chuyển "\" -> "/"
        rel_path = os.path.relpath(image_path, start=dataset_dir).replace("\\", "/")
        # ví dụ: "fox/fox_0037.jpg"

        try:
            vec = extract_vector(model, image_path)
            vectors.append(vec)
            paths.append(rel_path)
        except Exception as e:
            print("Lỗi xử lý ảnh:", image_path, "|", e)

pickle.dump(vectors, open("vectors.pkl", "wb"))
pickle.dump(paths, open("paths.pkl", "wb"))

print(f"Đã xử lý {len(paths)} ảnh, lưu vectors.pkl và paths.pkl")
