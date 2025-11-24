                            //===================== index =======================//
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

    slides[slideIndex - 1].style.display = "block";
    dots[slideIndex - 1].classList.add("active");
}

function plusSlides(n) {
    showSlides(slideIndex += n);
    resetInterval();
}

function currentSlide(n) {
    showSlides(slideIndex = n);
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
    //========================================= module.html =========================================//


  // CẤU HÌNH BACKEND
  const DEFAULT_BACKEND = "http://127.0.0.1:5000";
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
  const elResults = $("#results");
  const elLoading = $("#loading");
  const elErr = $("#err");
  const elBackend = $("#backend");
  const elBtnInfo = $("#btnInfo");
  const elBtnImg = $("#btnImg");

  const elTrainingInterface = document.querySelector(".training-interface");

  elBackend.textContent = BASE_URL || "(same origin)";
  let fileBlob = null;

  // Pagination state
  let allResults = [];
  let currentPage = 1;
  const perPage = 5;
  let maxPages = 1;

  const setLoading = (b) => (elLoading.style.display = b ? "flex" : "none");
  const setError = (msg) => (elErr.textContent = msg || "");

  const makeImgUrl = (relPath) => `${BASE_URL}/dataset/${relPath}`;

  // Ẩn/hiện section
  document.getElementById("btnSearch").addEventListener("click", function(){
    document.getElementById("training-section").style.display = "none";
    document.getElementById("results-section").style.display = "block";
  });

  // Tab Info
  document.getElementById("btnInfo").addEventListener("click", function(){
    document.getElementById("resultsTab").classList.remove("active");
    document.getElementById("infoTab").classList.add("active");

    this.classList.add("action");
    document.getElementById("btnImg").classList.remove("action");
    document.getElementById("pagination").style.display= "none";
    
  });

  // Tab Ảnh
  document.getElementById("btnImg").addEventListener("click", function () {
    document.getElementById("infoTab").classList.remove("active");
    document.getElementById("resultsTab").classList.add("active");
    
    this.classList.add("action");
    document.getElementById("btnInfo").classList.remove("action");
    document.getElementById("pagination").style.display= "flex";
  });

  // Render 1 page ảnh
  function renderResultsPage() {
    elResults.innerHTML = "";
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageData = allResults.slice(start, end);

    if (pageData.length === 0) {
      elResults.innerHTML = '<div class="no-results">Không có kết quả nào</div>';
      return;
    }

    pageData.forEach((it, idx) => {
      const url = makeImgUrl(it.path);
      const score = Number(it.distance ?? it.score ?? 0).toFixed(3);
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.innerHTML = `
        <span class="badge">#${start + idx + 1} · ${score}</span>
        <img alt="result ${start + idx + 1}" loading="lazy"/>
        <div class="meta">
          <span title="${it.path}">${it.path.split("/").slice(-2).join("/")}</span>
          <a href="${url}" target="_blank" rel="noreferrer">Mở</a>
        </div>`;
      const img = tile.querySelector("img");
      img.src = url;
      img.addEventListener("error", () => {
        tile.querySelector(".badge").textContent = "Lỗi ảnh";
        img.replaceWith(
          Object.assign(document.createElement("div"), {
            className: "img-fallback",
            innerHTML: "Không tải được ảnh",
          })
        );
      });
      elResults.appendChild(tile);
    });

    renderPagination();
  }

  // Render pagination bar
  function renderPagination() {
    const container = document.querySelector(".pagination");
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

    // Nút số trang (tối đa 15)
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

  // Preview ảnh
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

  // Pick/drop/clear
  elBtnPick.addEventListener("click", () => elFile.click());
  elFile.addEventListener("change", () => {
    setError("");
    validateAndEnable(elFile.files?.[0]);
  });

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
    elResults.innerHTML = "";
    document.querySelector(".pagination").innerHTML = "";
    document.getElementById("metaBox").innerHTML = "";
    document.getElementById("training-section").style.display = "block";
    document.getElementById("results-section").style.display = "none";
    document.querySelector(".training-section")?.scrollIntoView({ behavior: "smooth" });
  });

  // Search
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
      if (!Array.isArray(data.results)) {
        throw new Error("Phản hồi không đúng định dạng { meta, results}.");
      }

      elTrainingInterface.style.display = "none";
      renderMeta(data.meta);

      // Phân trang dữ liệu kết quả
      allResults = data.results;
      maxPages = Math.min(15, Math.ceil(allResults.length / perPage));
      currentPage = 1;
      renderResultsPage();

      function renderMeta(meta) {
        const box = document.querySelector("#metaBox");
        if (!meta) {
          box.innerHTML = '<div class="no-meta">Không có thông tin mô tả</div>';
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
                <h3>Nguyên liệu</h3>
                <ul>${ingredients.map((x) => `<li>${x}</li>`).join("")}</ul>
              </div>
              <div>
                <h3>Cách nấu</h3>
                <ol>${step.map((x) => `<li>${x}</li>`).join("")}</ol>
              </div>
            </div>
          </div>
        `;
      }

      document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
      elBtnSearch.disabled = false;
    }
  });

  // Khởi tạo tab mặc định
  document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("resultsTab").classList.add("active");
    document.getElementById("btnImg").classList.add("action");
  });
