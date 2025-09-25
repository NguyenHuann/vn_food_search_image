from pathlib import Path
import shutil, zipfile
import kagglehub
import os

def ensure_dataset(ds_id="nguyenhuann/vietnamese-food-image-dataset"):
    base_dir = Path(__file__).resolve().parent
    target = base_dir / "dataset"
    target.mkdir(parents=True, exist_ok=True)

    # Nếu đã có dữ liệu -> bỏ qua tải lại
    if target.exists() and any(target.rglob("*")):
        print("[dataset] exists -> skip download")
        return

    print("[dataset] downloading from KaggleHub...")
    cache_dir = Path(kagglehub.dataset_download(ds_id))  # thư mục cache KaggleHub
    print(f"[dataset] cached at: {cache_dir}")

    target.mkdir(parents=True, exist_ok=True)

    # Nếu có file .zip trong cache -> giải nén
    zips = list(cache_dir.glob("*.zip"))
    if zips:
        for zf in zips:
            print(f"[dataset] unzip {zf.name} -> {target}")
            with zipfile.ZipFile(zf, "r") as z:
                z.extractall(target)
    else:
        # Không có zip -> copy thẳng (dataset đã sẵn thư mục ảnh)
        for p in cache_dir.iterdir():
            dest = target / p.name
            if p.is_dir():
                shutil.copytree(p, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(p, dest)

    # Kiểm tra kết quả
    if not any(target.rglob("*")):
        raise RuntimeError("Dataset empty after download/unzip.")
    print("[dataset] ready:", target)

# Gọi hàm này trước khi load vectors
if __name__ == "__main__":
    ensure_dataset()


