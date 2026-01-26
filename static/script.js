//===================== index (Slider) =======================//
let slideIndex = 1;
let intervalId;
const intervalTime = 3000;

function showSlides(n) {
  let slides = document.getElementsByClassName("slides");
  let dots = document.getElementsByClassName("dot");

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
    dots[slideIndex - 1].classList.add("active");
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
  showSlides(slideIndex);
  startInterval();
});

//========================================= MAIN LOGIC =========================================//

const DEFAULT_BACKEND = "http://127.0.0.1:7860";
const urlParams = new URLSearchParams(location.search);
const BASE_URL = urlParams.get("backend") || DEFAULT_BACKEND;

// DOM helpers
const $ = (q) => document.querySelector(q);

const elFile = $("#file");
const elDrop = $("#drop");
const elPrev = $("#preview");
const elPrevImg = $("#previewImg");
const elBtnPick = $("#btnPick");
const elBtnSearch = $("#btnSearch");
const elBtnClear = $("#btnClear");
const elLoading = $("#loading");
const elErr = $("#err");
const elBackend = $("#backend");
const elBtnInfo = $("#btnInfo");
const elBtnImg = $("#btnImg");

const elTrainingInterface = document.querySelector(".training-interface");

// CHÚ Ý: Chúng ta chỉ dùng 1 grid duy nhất để chứa tất cả kết quả
const elMainGrid = $("#related-results-grid");
// Ẩn section cũ đi để tránh lỗi hiển thị nếu HTML vẫn còn
if ($("#same-section")) $("#same-section").style.display = "none";

if (elBackend) elBackend.textContent = BASE_URL || "(same origin)";
let fileBlob = null;

// Pagination state (Dùng chung cho TẤT CẢ kết quả)
let allResults = [];
let currentPage = 1;
const perPage = 12;
let maxPages = 1;

const setLoading = (b) => (elLoading.style.display = b ? "flex" : "none");
const setError = (msg) => (elErr.textContent = msg || "");
const makeImgUrl = (relPath) => `${BASE_URL}/dataset/${relPath}`;

// --- SỰ KIỆN UI (Tabs) ---
elBtnInfo.addEventListener("click", function () {
  document.getElementById("resultsTab").classList.remove("active");
  document.getElementById("infoTab").classList.add("active");
  this.classList.add("action");
  document.getElementById("btnImg").classList.remove("action");
});

elBtnImg.addEventListener("click", function () {
  document.getElementById("infoTab").classList.remove("active");
  document.getElementById("resultsTab").classList.add("active");
  this.classList.add("action");
  document.getElementById("btnInfo").classList.remove("action");
});

// --- RENDER FUNCTIONS ---

// Hàm tạo thẻ ảnh
function createImageTile(item, index) {
  const url = makeImgUrl(item.path);
  const score = Number(item.distance ?? 0).toFixed(3);

  const tile = document.createElement("div");
  // Thêm class cơ bản
  tile.className = "tile";

  // LOGIC QUAN TRỌNG: Nếu là món đúng (isCorrect = true) -> Thêm class để CSS tô viền xanh
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

// Hàm Render chính (Hiển thị trang hiện tại của danh sách đã gộp)
function renderResultsPage() {
  elMainGrid.innerHTML = ""; // Xóa nội dung cũ

  if (allResults.length === 0) {
    elMainGrid.innerHTML =
      '<div class="no-results">Không tìm thấy kết quả nào.</div>';
    return;
  }

  // Tính toán cắt mảng cho phân trang
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageData = allResults.slice(start, end);

  // Vẽ từng thẻ
  pageData.forEach((item, idx) => {
    const tile = createImageTile(item, idx);
    elMainGrid.appendChild(tile);
  });

  renderPagination();
}

function renderPagination() {
  const container = document.querySelector(".pagination");
  if (!container) return;
  container.innerHTML = "";

  if (maxPages <= 1) return;

  // Prev
  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn";
  prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i>`;
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderResultsPage();
    }
  });
  container.appendChild(prevBtn);

  // Page Numbers logic
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(maxPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (i === currentPage ? " active" : "");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      currentPage = i;
      renderResultsPage();
    });
    container.appendChild(btn);
  }

  // Next
  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn";
  nextBtn.innerHTML = `<i class="fas fa-chevron-right"></i>`;
  nextBtn.disabled = currentPage === maxPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage < maxPages) {
      currentPage++;
      renderResultsPage();
    }
  });
  container.appendChild(nextBtn);
}

function renderMeta(meta) {
  const box = document.querySelector("#metaBox");
  if (!box) return;

  if (!meta) {
    box.innerHTML =
      '<div class="no-meta">Không tìm thấy thông tin món ăn phù hợp.</div>';
    return;
  }
  const name = meta.name || meta.dish_id || "Món ăn";
  const intro = meta.intro || "";
  const ingredients = Array.isArray(meta.ingredients) ? meta.ingredients : [];
  const step = Array.isArray(meta.step) ? meta.step : [];

  box.innerHTML = `
      <div class="metaCard">
        <h2 class="metaTitle">${name}</h2>
        <p class="metaIntro">${intro}</p>
        <div class="metaCols">
          <div>
            <h3><i class="fas fa-carrot"></i> Nguyên liệu</h3>
            <ul>${ingredients.map((x) => `<li>${x}</li>`).join("")}</ul>
          </div>
          <div>
            <h3><i class="fas fa-fire"></i> Cách nấu</h3>
            <ol>${step.map((x) => `<li>${x}</li>`).join("")}</ol>
          </div>
        </div>
      </div>
    `;
}

// --- FILE HANDLING ---
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
  if (!/\.(jpg|jpeg|png|bmp|webp)$/i.test(file.name)) {
    setError("File ảnh không hợp lệ");
    fileBlob = null;
    elBtnSearch.disabled = true;
    return;
  }
  fileBlob = file;
  showPreview(fileBlob);
  elBtnSearch.disabled = false;
}

elBtnPick.addEventListener("click", () => elFile.click());
elFile.addEventListener("change", () => {
  setError("");
  validateAndEnable(elFile.files?.[0]);
});

// Drag & Drop
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
elDrop.addEventListener("click", () => elFile.click());
elDrop.addEventListener("drop", (e) => {
  setError("");
  const f = e.dataTransfer?.files?.[0];
  validateAndEnable(f);
});

elBtnClear.addEventListener("click", () => {
  setError("");
  fileBlob = null;
  elFile.value = "";
  elPrevImg.src = "";
  elPrev.style.display = "none";
  elBtnSearch.disabled = true;
  elMainGrid.innerHTML = "";
  document.querySelector(".pagination").innerHTML = "";
  document.getElementById("metaBox").innerHTML = "";

  // Reset View
  document.getElementById("training-section").style.display = "block";
  document.getElementById("results-section").style.display = "none";
  if (elTrainingInterface) elTrainingInterface.style.display = "flex";

  document
    .querySelector(".training-section")
    ?.scrollIntoView({ behavior: "smooth" });
});

// --- SEARCH LOGIC (PHẦN QUAN TRỌNG NHẤT) ---
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

    // 1. Render Metadata
    renderMeta(data.meta);

    // 2. GỘP DỮ LIỆU & ĐÁNH DẤU
    // - Lấy danh sách same_dish, thêm cờ isCorrect = true
    const sameList = (data.results.same_dish || []).map((item) => ({
      ...item,
      isCorrect: true,
    }));

    // - Lấy danh sách related, thêm cờ isCorrect = false
    const relatedList = (data.results.related || []).map((item) => ({
      ...item,
      isCorrect: false,
    }));

    // - Gộp chung lại
    allResults = [...sameList, ...relatedList];

    // 3. SẮP XẾP
    // - Sắp xếp theo distance tăng dần (số nhỏ nhất lên đầu)
    // - Nếu muốn món đúng LUÔN lên đầu bất kể distance, hãy thêm logic ưu tiên item.isCorrect
    allResults.sort((a, b) => {
      return parseFloat(a.distance) - parseFloat(b.distance);
    });

    // Setup pagination
    maxPages = Math.min(15, Math.ceil(allResults.length / perPage));
    currentPage = 1;

    // 4. RENDER
    renderResultsPage();

    // 5. Chuyển view
    document.getElementById("training-section").style.display = "none";
    if (elTrainingInterface) elTrainingInterface.style.display = "none";

    const resSection = document.getElementById("results-section");
    if (resSection) resSection.style.display = "block";

    // Focus tab ảnh
    elBtnImg.click();
    resSection?.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error(err);
    setError(String(err.message || err));
  } finally {
    setLoading(false);
    elBtnSearch.disabled = false;
  }
});
