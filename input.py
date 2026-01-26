import math
import os

import matplotlib.image as mpimg
import matplotlib.pyplot as plt
import requests
from PIL import Image
from matplotlib import gridspec

#  CẤU HÌNH
API_URL = "http://localhost:5000/search"
QUERY_IMAGE = "testimage/banh_beo/9.jpg"  # ảnh query
DATASET_ROOT = "./dataset"  # gốc dataset để resolve path tương đối
TOP_K = 10  # số ảnh kết quả muốn hiển thị (None = tất cả)
MAX_COLS = 5  # số cột tối đa trong grid


def resolve_local_path(p: str) -> str | None:
    # chuẩn hóa đường dẫn
    if not p:
        return None
    p = p.replace("\\", "/")
    if DATASET_ROOT is not None and not os.path.isabs(p):
        p = os.path.join(DATASET_ROOT, p)
    return os.path.normpath(p)


def read_local_image(path: str):
    # đọc ảnh local
    try:
        return mpimg.imread(path)
    except Exception:
        try:
            with Image.open(path) as im:
                return mpimg.pil_to_array(im.convert("RGB"))
        except Exception as e:
            print(f"[WARN] Không thể đọc ảnh: {path} -> {e}")
            return None


def make_meta_text(meta: dict) -> str:
    if not meta:
        return "Không có metadata."
    name = meta.get("name") or meta.get("dish_id") or "Món ăn"
    intro = meta.get("intro") or ""
    ings = meta.get("ingredients") or []
    steps = meta.get("step") or []

    lines = [f"{name}", f"{intro}", ""]
    if ings:
        lines.append("Nguyên liệu:")
        lines += [f"• {x}" for x in ings]
        lines.append("")
    if steps:
        lines.append("Cách nấu:")
        lines += [f"{i + 1}. {s}" for i, s in enumerate(steps)]
    return "\n".join(lines)


def main():
    # Gửi ảnh query lên API (multipart/form-data)
    with open(QUERY_IMAGE, "rb") as f:
        resp = requests.post(API_URL, files={"image": f})

    print("HTTP Status:", resp.status_code)

    # Parse JSON
    try:
        data = resp.json()
    except Exception:
        print("Response text:", resp.text[:500])
        return

    # Chuẩn hóa kết quả
    meta = None
    if isinstance(data, dict):
        meta = data.get("meta")
        results = data.get("results", [])
    elif isinstance(data, list):
        results = data
    else:
        print("[WARN] Không nhận diện được cấu trúc kết quả. Mặc định rỗng.")
        results = []

    # Giới hạn Top-K
    if isinstance(TOP_K, int) and TOP_K > 0:
        results = results[:TOP_K]

    # Danh sách item để vẽ: Query + Kết quả (đổi 'distance' -> score hiển thị)
    items = [{"title": "Query", "path": QUERY_IMAGE, "score": None}]
    for r in results:
        if isinstance(r, dict):
            path = r.get("path") or r.get("image") or r.get("file")
            score = r.get("distance", r.get("score", None))
        else:
            path, score = str(r), None
        local_path = resolve_local_path(path)
        title = (
            f"score: {float(score):.3f}"
            if isinstance(score, (int, float))
            else os.path.basename(local_path or "")
        )
        items.append({"title": title, "path": local_path, "score": score})

    total = len(items)
    if total == 0:
        print("Không có gì để hiển thị.")
        return

    # VẼ FIGURE: Hàng đầu là TEXT metadata (nếu có), bên dưới là grid ảnh
    # Tính lưới ảnh
    cols = min(total, MAX_COLS if MAX_COLS >= 1 else 5)
    rows = math.ceil(total / cols)

    # Nếu có meta, thêm 1 hàng text ở trên
    has_meta = meta is not None
    fig_rows = rows + (1 if has_meta else 0)

    fig = plt.figure(figsize=(4 * cols, 3.8 * fig_rows))
    gs = gridspec.GridSpec(
        fig_rows, cols, height_ratios=([1] if has_meta else []) + [1] * rows, figure=fig
    )

    # Hàng ảnh
    start_row = 1 if has_meta else 0
    for idx, it in enumerate(items):
        r = idx // cols
        c = idx % cols
        ax = fig.add_subplot(gs[start_row + r, c])
        img = read_local_image(it["path"]) if it["path"] else None
        if img is not None:
            ax.imshow(img)
            ax.set_title(it["title"], fontsize=10)
        else:
            ax.text(
                0.5,
                0.5,
                f"Không đọc được ảnh\n{os.path.basename(it['path'] or '')}",
                ha="center",
                va="center",
                wrap=True,
            )
        ax.axis("off")

    # Hàng metadata (span toàn bộ cột)
    if has_meta:
        meta_ax = fig.add_subplot(gs[0, :])
        meta_ax.axis("off")
        meta_text = make_meta_text(meta)
        # vẽ text căn trái, wrap theo trục x
        meta_ax.text(0.01, 0.98, meta_text, ha="left", va="top", wrap=True, fontsize=11)

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()
