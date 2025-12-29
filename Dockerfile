# Dùng Python 3.9 ổn định cho TensorFlow
FROM python:3.9

# Tạo user để tránh chạy quyền root (bảo mật)
RUN useradd -m -u 1000 user
WORKDIR /app

# Copy requirements và cài đặt
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy toàn bộ code vào
COPY --chown=user . /app

# Phân quyền
USER user

# Hugging Face chạy trên port 7860
EXPOSE 7860

# Lệnh chạy server
CMD ["python", "search_image.py"]