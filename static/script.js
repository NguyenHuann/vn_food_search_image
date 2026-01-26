//===================== index (Slider) =======================//
let slideIndex = 1;
let intervalId;
const intervalTime = 3000;

function showSlides(n) {
  let slides = document.getElementsByClassName("slides");
  let dots = document.getElementsByClassName("dot");

  if (!slides.length) return; // Bảo vệ nếu không có slider

  if (n > slides.length) slideIndex = 1;
  if (n < 1) slideIndex = slides.length;

  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.remove("active");
  }

  if (slides.length > 0) {
    slides[slideIndex - 1].style.display = "block";
    if (dots.length > 0) dots[slideIndex - 1].classList.add("active");
  }
}

function plusSlides(n) {
  showSlides((slideIndex += n));
  resetInterval();
}

function currentSlide(n) {
  showSlides((slideIndex = n));
  resetInterval();
}

function startInterval() {
  intervalId = setInterval(() => plusSlides(1), intervalTime);
}

function resetInterval() {
  clearInterval(intervalId);
  startInterval();
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementsByClassName("slides").length > 0) {
    showSlides(slideIndex);
    startInterval();
  }
});

//========================================= MAIN LOGIC =========================================//

const DEFAULT_BACKEND = "http://127.0.0.1:7860";
const urlParams = new URLSearchParams(location.search);
const BASE_URL = urlParams.get("backend") || DEFAULT_BACKEND;

// DOM helpers
const $ = (q) => document.querySelector(q);

// -- CÁC ELEMENT MỚI --
const elDrop = $("#drop");
const elPrev = $("#preview");
const elPrevImg = $("#previewImg");

// Nút bấm mới
const btnCamera = $("#btnCamera");
const btnUpload = $("#btnUpload");
const fileInputCamera = $("#fileCamera");
const fileInputUpload = $("#fileUpload");

const elBtnSearch = $("#btnSearch");
const elBtnClear = $("#btnClear");
const elLoading = $("#loading");
const elErr = $("#err");

const elTrainingInterface = document.querySelector(".training-interface");
const elResultsSection = $("#results-section");

// Grid kết quả
const elMainGrid = $("#related-results-grid");

// Biến lưu trạng thái
let fileBlob = null;
let allResults = [];
let currentPage = 1;
const perPage = 12;
let maxPages = 1;

const setLoading = (b) => (elLoading.style.display = b ? "flex" : "none");
const setError = (msg) => (elErr.textContent = msg || "");
const makeImgUrl = (relPath) => `${BASE_URL}/dataset/${relPath}`;

// --- XỬ LÝ SỰ KIỆN INPUT ẢNH (CAMERA & UPLOAD) ---

// 1. Nút Camera
btnCamera.addEventListener("click", () => {
  fileInputCamera.click();
});
fileInputCamera.addEventListener("change", (e) => {
  setError("");
  validateAndEnable(e.target.files?.[0]);
});

// 2. Nút Upload
btnUpload.addEventListener("click", () => {
  fileInputUpload.click();
});
fileInputUpload.addEventListener("change", (e) => {
  setError("");
  validateAndEnable(e.target.files?.[0]);
});

// 3. Drag & Drop (Kéo thả vào vùng drop)
["dragenter", "dragover"].forEach((ev) =>
  elDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    elDrop.classList.add("hover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  elDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    elDrop.classList.remove("hover");
  })
);
// Click vào vùng drop thì mặc định mở upload file
elDrop.addEventListener("click", () => fileInputUpload.click());
elDrop.addEventListener("drop", (e) => {
  setError("");
  const f = e.dataTransfer?.files?.[0];
  validateAndEnable(f);
});

// --- RENDER FUNCTIONS ---

// Hàm tạo thẻ ảnh kết quả
function createImageTile(item, index) {
  const url = makeImgUrl(item.path);
  const score = Number(item.distance ?? 0).toFixed(3);

  const tile = document.createElement("div");
  tile.className = "tile";

  if (item.isCorrect) {
    tile.classList.add("correct-match");
  }

  tile.innerHTML = `
    <img alt="result" loading="lazy" src="${url}" />
    ${item.isCorrect ? '<div class="badge">Chính xác</div>' : ""} 
    <div class="meta">
        <span title="${item.path}">Dist: ${score}</span>
        <a href="${url}" target="_blank" rel="noreferrer">Mở</a>
    </div>`;

  // Xử lý khi ảnh lỗi
  const img = tile.querySelector("img");
  img.addEventListener("error", () => {
    img.replaceWith(
      Object.assign(document.createElement("div"), {
        className: "img-fallback",
        innerHTML: "Lỗi ảnh",
        style:
          "display:flex;align-items:center;justify-content:center;height:180px;background:#eee;color:#777;",
      })
    );
  });
  return tile;
}

// Render danh sách kết quả (Grid)
function renderResultsPage() {
  elMainGrid.innerHTML = "";

  if (allResults.length === 0) {
    elMainGrid.innerHTML =
      '<div class="no-results" style="grid-column: 1/-1; text-align:center; padding: 20px;">Không tìm thấy kết quả nào.</div>';
    return;
  }

  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageData = allResults.slice(start, end);

  pageData.forEach((item, idx) => {
    const tile = createImageTile(item, idx);
    elMainGrid.appendChild(tile);
  });

  renderPagination();
}

// Render phân trang
function renderPagination() {
  const container = document.querySelector(".pagination");
  if (!container) return;
  container.innerHTML = "";

  if (maxPages <= 1) return;

  // Nút Prev
  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn";
  prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderResultsPage();
      elMainGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  container.appendChild(prevBtn);

  // Các số trang
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(maxPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (i === currentPage ? " active" : "");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      currentPage = i;
      renderResultsPage();
      elMainGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    container.appendChild(btn);
  }

  // Nút Next
  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn";
  nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
  nextBtn.disabled = currentPage === maxPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage < maxPages) {
      currentPage++;
      renderResultsPage();
      elMainGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  container.appendChild(nextBtn);
}

// Render Metadata (Giao diện Sidebar Mới)
function renderMeta(meta) {
  const box = document.querySelector("#metaBox");
  if (!box) return;

  if (!meta) {
    box.innerHTML = '<p class="text-muted">Không có thông tin chi tiết.</p>';
    return;
  }
  const name = meta.name || meta.dish_id || "Món ăn";
  const ingredients = Array.isArray(meta.ingredients) ? meta.ingredients : [];
  const steps = Array.isArray(meta.step) ? meta.step : [];

  // Tạo HTML gọn gàng cho Sidebar
  box.innerHTML = `
      <h2 class="metaTitle">${name}</h2>
      
      <h3><i class="fas fa-carrot"></i> Nguyên liệu:</h3>
      <ul>
        ${
          ingredients.length > 0
            ? ingredients.map((x) => `<li>${x}</li>`).join("")
            : "<li>Đang cập nhật...</li>"
        }
      </ul>
      
      <h3><i class="fas fa-fire"></i> Cách làm:</h3>
      <div class="meta-step-scroll">
        <ol>
          ${
            steps.length > 0
              ? steps.map((x) => `<li>${x}</li>`).join("")
              : "<li>Đang cập nhật...</li>"
          }
        </ol>
      </div>
    `;
}

// --- LOGIC XỬ LÝ ẢNH ---
function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    elPrevImg.src = e.target.result;
    elPrev.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function validateAndEnable(file) {
  if (!file) return;
  // Kiểm tra đuôi file
  if (!/\.(jpg|jpeg|png|bmp|webp)$/i.test(file.name)) {
    setError("File ảnh không hợp lệ");
    fileBlob = null;
    elBtnSearch.disabled = true;
    return;
  }
  fileBlob = file;
  showPreview(fileBlob);
  elBtnSearch.disabled = false; // Bật nút tìm kiếm
}

// Nút Làm mới (Reset)
elBtnClear.addEventListener("click", () => {
  setError("");
  fileBlob = null;
  fileInputUpload.value = "";
  fileInputCamera.value = ""; // Reset cả input camera
  elPrevImg.src = "";
  elPrev.style.display = "none";
  elBtnSearch.disabled = true;
  
  // Xóa kết quả
  elMainGrid.innerHTML = "";
  document.querySelector("#pagination").innerHTML = "";
  document.getElementById("metaBox").innerHTML = "";
  document.getElementById("queryImgDisplay").src = ""; // Xóa ảnh sidebar

  // Reset View về màn hình Upload
  document.getElementById("training-section").style.display = "block";
  elResultsSection.style.display = "none";
  if (elTrainingInterface) elTrainingInterface.style.display = "flex";

  document.querySelector(".training-section")?.scrollIntoView({ behavior: "smooth" });
});

// --- LOGIC TÌM KIẾM (SEARCH) ---
elBtnSearch.addEventListener("click", async () => {
  if (!fileBlob) return;
  setError("");
  setLoading(true);
  elBtnSearch.disabled = true;

  try {
    const fd = new FormData();
    fd.append("image", fileBlob);

    const resp = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      body: fd,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    const data = await resp.json();

    if (!data.results || typeof data.results !== "object") {
      throw new Error("Phản hồi không đúng định dạng.");
    }

    // --- CẬP NHẬT GIAO DIỆN SPLIT VIEW ---

    // 1. Hiển thị ảnh Query sang cột trái (Sidebar)
    const queryImg = document.getElementById("queryImgDisplay");
    if (queryImg) queryImg.src = elPrevImg.src;

    // 2. Render Metadata vào cột trái
    renderMeta(data.meta);

    // 3. Xử lý dữ liệu kết quả
    const sameList = (data.results.same_dish || []).map((item) => ({
      ...item,
      isCorrect: true,
    }));

    const relatedList = (data.results.related || []).map((item) => ({
      ...item,
      isCorrect: false,
    }));

    allResults = [...sameList, ...relatedList];

    // Sắp xếp
    allResults.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

    // Phân trang
    maxPages = Math.min(15, Math.ceil(allResults.length / perPage));
    currentPage = 1;

    // 4. Render Grid
    renderResultsPage();

    // 5. CHUYỂN VIEW (Ẩn Upload -> Hiện Result)
    document.getElementById("training-section").style.display = "none";
    if (elTrainingInterface) elTrainingInterface.style.display = "none";

    elResultsSection.style.display = "block";
    elResultsSection.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.error(err);
    setError(String(err.message || err));
  } finally {
    setLoading(false);
    elBtnSearch.disabled = false;
  }
});