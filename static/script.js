// ================================================================
// 1. BACKGROUND MOTION CANVAS (HIỆU ỨNG HẠT)
// ================================================================
(function initCanvas() {
  const canvas = document.getElementById("motion-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const config = {
    starColor: "rgba(108, 99, 255, 0.5)",
    lineColor: "rgba(108, 99, 255, 0.15)",
    amount: 80,
    speed: 0.5,
    linkRadius: 150,
  };
  let w,
    h,
    stars = [];

  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  };

  class Star {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * config.speed;
      this.vy = (Math.random() - 0.5) * config.speed;
      this.size = Math.random() * 2 + 1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > w) this.vx *= -1;
      if (this.y < 0 || this.y > h) this.vy *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = config.starColor;
      ctx.fill();
    }
  }

  const init = () => {
    resize();
    stars = [];
    for (let i = 0; i < config.amount; i++) stars.push(new Star());
  };

  const animate = () => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < stars.length; i++) {
      stars[i].update();
      stars[i].draw();
      for (let j = i; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < config.linkRadius) {
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.strokeStyle = config.lineColor;
          ctx.lineWidth = 1 - dist / config.linkRadius;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  };

  window.addEventListener("resize", () => {
    resize();
    init();
  });
  init();
  animate();
})();

// ================================================================
// 2. MAIN LOGIC (TÌM KIẾM ẢNH)
// ================================================================
const DEFAULT_BACKEND = "http://127.0.0.1:5000";
const urlParams = new URLSearchParams(location.search);
const BASE_URL = urlParams.get("backend") || DEFAULT_BACKEND;

// DOM Helpers
const $ = (q) => document.querySelector(q);
const elDrop = $("#drop");
const elPrev = $("#preview");
const elPrevImg = $("#previewImg");
const elErr = $("#err");
const elLoading = $("#loading");

// Buttons & Inputs
const btnCamera = $("#btnCamera");
const btnUpload = $("#btnUpload");
const fileInputCamera = $("#fileCamera");
const fileInputUpload = $("#fileUpload");
const elBtnSearch = $("#btnSearch");
const elBtnClear = $("#btnClear");

// Sections
const sectionTraining = $(".training-section");
const sectionResults = $("#results-section");
const elMainGrid = $("#related-results-grid");

// Variables
let fileBlob = null;
let allResults = [];
let currentPage = 1;
const perPage = 12;
let maxPages = 1;

const setError = (msg) => {
  if (elErr) {
    elErr.style.display = msg ? "block" : "none";
    elErr.textContent = msg || "";
  }
};

// --- HÀM TẠO URL ẢNH (ĐÃ FIX) ---
// Hàm này đảm bảo nối đúng domain backend + folder dataset + đường dẫn ảnh
const makeImgUrl = (relPath) => {
  if (!relPath) return "https://via.placeholder.com/300x200?text=No+Image";
  // Nếu đường dẫn đã là tuyệt đối (có http) thì giữ nguyên
  if (relPath.startsWith("http")) return relPath;

  // Xử lý dấu gạch chéo để tránh bị double slash (//)
  const cleanPath = relPath.startsWith("/") ? relPath.slice(1) : relPath;
  return `${BASE_URL}/dataset/${cleanPath}`;
};

// --- CÁC BIẾN CHO CAMERA LAPTOP ---
const elCameraModal = document.getElementById("camera-modal");
const elVideo = document.getElementById("video-feed");
const elCanvas = document.getElementById("canvas-capture");
const btnSnap = document.getElementById("btn-snap");
const btnCloseCamera = document.getElementById("btn-close-camera");
let videoStream = null;

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

// --- XỬ LÝ SỰ KIỆN NÚT BẤM ---

// 1. NÚT CAMERA
if (btnCamera) {
  btnCamera.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMobileDevice()) {
      fileInputCamera.click();
    } else {
      startCamera();
    }
  });
}
if (fileInputCamera) {
  fileInputCamera.addEventListener("change", (e) =>
    handleFileSelect(e.target.files?.[0]),
  );
}

// 2. NÚT UPLOAD
if (btnUpload) {
  btnUpload.addEventListener("click", (e) => {
    e.stopPropagation();
    if (fileInputUpload) fileInputUpload.click();
  });
}
if (fileInputUpload) {
  fileInputUpload.addEventListener("change", (e) =>
    handleFileSelect(e.target.files?.[0]),
  );
}

// 3. XỬ LÝ DRAG & DROP
if (elDrop) {
  ["dragenter", "dragover"].forEach((ev) =>
    elDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      elDrop.classList.add("hover");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    elDrop.addEventListener(ev, (e) => {
      e.preventDefault();
      elDrop.classList.remove("hover");
    }),
  );
  elDrop.addEventListener("drop", (e) => {
    handleFileSelect(e.dataTransfer?.files?.[0]);
  });
}

// --- CÁC HÀM CAMERA ---
async function startCamera() {
  try {
    if (elCameraModal) elCameraModal.style.display = "flex";
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    if (elVideo) {
      elVideo.srcObject = videoStream;
      elVideo.style.transform = "scaleX(-1)";
    }
  } catch (err) {
    console.error("Camera Error:", err);
    alert("Không thể truy cập Camera. Vui lòng kiểm tra quyền.");
    closeCamera();
  }
}

function closeCamera() {
  if (elCameraModal) elCameraModal.style.display = "none";
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }
}

if (btnSnap) {
  btnSnap.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!videoStream) return;
    const context = elCanvas.getContext("2d");
    elCanvas.width = elVideo.videoWidth;
    elCanvas.height = elVideo.videoHeight;
    context.drawImage(elVideo, 0, 0, elCanvas.width, elCanvas.height);
    elCanvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "webcam_capture.jpg", {
            type: "image/jpeg",
          });
          handleFileSelect(file);
          closeCamera();
        }
      },
      "image/jpeg",
      0.95,
    );
  });
}

if (btnCloseCamera)
  btnCloseCamera.addEventListener("click", (e) => {
    e.stopPropagation();
    closeCamera();
  });

// --- XỬ LÝ FILE ---
function handleFileSelect(file) {
  setError("");
  if (!file) return;
  if (fileInputUpload) fileInputUpload.value = "";
  if (fileInputCamera) fileInputCamera.value = "";

  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
  ];
  if (!validTypes.includes(file.type)) {
    setError("Định dạng file không hợp lệ.");
    return;
  }

  fileBlob = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    elPrevImg.src = e.target.result;
    elPrev.style.display = "block";
    document.querySelector(".big-actions").style.display = "none";
    document.querySelector(".search-actions").style.display = "flex";
    elBtnSearch.disabled = false;
    elPrev.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  reader.readAsDataURL(file);
}

// --- XỬ LÝ NÚT TÌM KIẾM (ĐÃ NÂNG CẤP LOGIC TỰ TÌM DỮ LIỆU) ---
if (elBtnSearch) {
  elBtnSearch.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!fileBlob) return;

    setError("");
    elBtnSearch.disabled = true;

    // Loading
    if (elLoading) {
      elLoading.style.display = "flex";
      const textSpan = elLoading.querySelector("span");
      if (textSpan) textSpan.textContent = "Đang khởi tạo...";
    }

    try {
      const fd = new FormData();
      fd.append("image", fileBlob);

      // 1. Gọi API
      const fetchPromise = fetch(`${BASE_URL}/search`, {
        method: "POST",
        body: fd,
      });

      // 2. Hiệu ứng Loading
      const textSpan = elLoading.querySelector("span");
      const messages = [
        "Đang tải ảnh lên máy chủ...",
        "AI đang trích xuất đặc trưng...",
        "Đang so khớp với Dataset...",
        "Đang tổng hợp kết quả...",
      ];
      const delays = [900, 900, 1000, 800]; // Giảm nhẹ thời gian chờ để mượt hơn

      for (let i = 0; i < messages.length; i++) {
        if (textSpan) textSpan.textContent = messages[i];
        await new Promise((resolve) => setTimeout(resolve, delays[i]));
      }

      // 3. Xử lý kết quả từ API
      const resp = await fetchPromise;
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Lỗi (${resp.status}): ${text}`);
      }

      const data = await resp.json();

      // --- DEBUG QUAN TRỌNG: In ra Console để kiểm tra ---
      console.log("=== KẾT QUẢ API TRẢ VỀ ===", data);

      if (!data.results && !Array.isArray(data))
        throw new Error("Dữ liệu trả về không có mục results.");

      // Hiển thị lại ảnh query ở phần kết quả
      const queryImg = document.getElementById("queryImgDisplay");
      if (queryImg && typeof elPrevImg !== "undefined") {
        queryImg.src = elPrevImg.src;
      }

      // Render Meta (Nếu có)
      if (data.meta) renderMeta(data.meta);

      // --- [LOGIC MỚI] TỰ ĐỘNG GOM DỮ LIỆU (SMART MERGE) ---
      let rawList = [];
      const resultsSource = data.results || data; // Phòng trường hợp results nằm ngay ở root

      if (Array.isArray(resultsSource)) {
        // Trường hợp 1: API trả về thẳng một danh sách [item, item...]
        rawList = resultsSource;
      } else if (typeof resultsSource === "object") {
        // Trường hợp 2: API trả về object { same_dish: [], related: [], ... }
        // Code này sẽ tự động lấy TẤT CẢ các mảng con bên trong, bất kể tên là gì
        Object.keys(resultsSource).forEach((key) => {
          const val = resultsSource[key];
          if (Array.isArray(val)) {
            console.log(
              `Đã tìm thấy danh sách ảnh trong key: "${key}" với ${val.length} phần tử.`,
            );
            rawList = rawList.concat(val);
          }
        });
      }

      console.log("Tổng số ảnh tìm được:", rawList.length);

      if (rawList.length === 0) {
        // Nếu vẫn bằng 0, có thể do lỗi cấu trúc quá lạ
        console.warn("CẢNH BÁO: Không tìm thấy mảng nào trong data.results");
      }

      // Sắp xếp theo khoảng cách (thấp nhất lên đầu)
      rawList.sort((a, b) => {
        const distA = parseFloat(a.distance !== undefined ? a.distance : 999);
        const distB = parseFloat(b.distance !== undefined ? b.distance : 999);
        return distA - distB;
      });

      // Xác định folder "đúng" (dựa vào kết quả tốt nhất - phần tử đầu tiên)
      // Lưu ý: Kiểm tra kỹ tên biến folder hoặc class_name trong API
      const bestMatch = rawList.length > 0 ? rawList[0] : null;
      const bestMatchFolder = bestMatch
        ? bestMatch.folder || bestMatch.class_name || bestMatch.label
        : null;

      // Chuẩn hóa dữ liệu cho hàm render
      allResults = rawList.map((item) => {
        return {
          ...item,
          // Ưu tiên lấy path, nếu ko có thì lấy image_path, url, hoặc filename
          path: item.path || item.image_path || item.url || item.filename || "",

          // Logic đúng sai: Nếu trùng folder với kết quả top 1
          isCorrect:
            bestMatchFolder &&
            (item.folder === bestMatchFolder ||
              item.class_name === bestMatchFolder ||
              item.label === bestMatchFolder),
        };
      });

      // Tính toán phân trang
      maxPages = Math.ceil(allResults.length / perPage) || 1;
      currentPage = 1;

      // --- HIỂN THỊ KẾT QUẢ ---
      renderResultsPage(); // Gọi hàm render chính

      // Chuyển đổi màn hình
      if (sectionTraining) sectionTraining.style.display = "none";
      if (sectionResults) sectionResults.style.display = "block";

      // Scroll xuống kết quả
      setTimeout(() => {
        sectionResults.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      console.error(err);
      setError("Lỗi xử lý: " + err.message);
      elBtnSearch.disabled = false;
    } finally {
      if (elLoading) elLoading.style.display = "none";
      if (elBtnSearch) elBtnSearch.disabled = false;
    }
  });
}

// --- NÚT LÀM MỚI ---
if (elBtnClear) {
  elBtnClear.addEventListener("click", (e) => {
    e.stopPropagation();
    window.location.reload();
  });
}

// ================================================================
// 3. RENDER FUNCTIONS (HIỂN THỊ GIAO DIỆN)
// ================================================================

function renderResultsPage() {
  if (!elMainGrid) return; // Bảo vệ nếu không tìm thấy element
  elMainGrid.innerHTML = "";

  if (allResults.length === 0) {
    elMainGrid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:#fff;">Không tìm thấy kết quả.</div>';
    return;
  }

  // Logic phân trang
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageData = allResults.slice(start, end);

  // Render từng thẻ ảnh
  pageData.forEach((item) => {
    const tile = createImageTile(item);
    elMainGrid.appendChild(tile);
  });

  renderPagination();
}

// Hàm tạo thẻ HTML cho từng ảnh
function createImageTile(item) {
  // Tạo URL ảnh
  const url = makeImgUrl(item.path);

  // 1. Xử lý TÊN MÓN ĂN
  let rawName = item.folder || item.class_name || "Món ăn";
  const dishName = rawName.replace(/_/g, " ").toUpperCase();

  // 2. Xử lý ĐỘ TƯƠNG ĐỒNG (QUAN TRỌNG: SỬA LẠI ĐOẠN NÀY)
  // Backend trả về 'score' (Cosine Similarity: 0 -> 1)
  // Nếu item.score tồn tại thì dùng nó, nếu không mới tìm đến distance
  let similarityVal = 0;

  if (item.score !== undefined) {
    // Trường hợp Backend trả về Score (độ giống)
    similarityVal = parseFloat(item.score) * 100;
  } else if (item.distance !== undefined) {
    // Trường hợp Backend trả về Distance (khoảng cách)
    // Giả sử distance Euclid hoặc Cosine distance (1 - score)
    similarityVal = (1 - parseFloat(item.distance)) * 100;
  }

  // Làm tròn 1 chữ số thập phân
  const similarity = Math.max(0, Math.min(100, similarityVal)).toFixed(1);

  const tile = document.createElement("div");
  tile.className = "tile";

  // Logic viền: Nếu độ giống > 90% hoặc là kết quả top 1 thì xanh
  if (item.isCorrect || parseFloat(similarity) > 90) {
    tile.classList.add("correct-match");
    tile.style.border = "2px solid #00ff88";
    tile.style.boxShadow = "0 0 10px rgba(0, 255, 136, 0.5)";
  } else {
    tile.style.border = "2px solid rgba(255, 100, 100, 0.3)";
  }

  tile.innerHTML = `
    <div class="image-wrapper" style="position: relative;">
        <img src="${url}" loading="lazy" alt="${dishName}" onerror="this.src='https://via.placeholder.com/300x200?text=Error'"/>
        
        ${
          item.isCorrect
            ? '<span class="badge" style="background:#00ff88; color:#000; position:absolute; top:5px; right:5px; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; z-index:10;">CHÍNH XÁC</span>'
            : ""
        }
    </div>
    
    <div class="meta" style="padding: 8px; background: rgba(0,0,0,0.6);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="text-align:left; overflow:hidden; padding-right: 5px;">
                <div style="font-weight:bold; font-size:14px; color:#fff; white-space:nowrap; text-overflow:ellipsis; max-width:130px;" title="${dishName}">
                    ${dishName}
                </div>
                <div style="font-size:12px; color:#ccc; margin-top:2px;">
                    Độ giống: <span style="color:${parseFloat(similarity) > 80 ? "#00ff88" : "#ffcc00"}">${similarity}%</span>
                </div>
            </div>
            <a href="${url}" target="_blank" style="font-size:11px; padding:4px 8px; background:#444; color:#fff; text-decoration:none; border-radius:4px; white-space:nowrap;">Xem</a>
        </div>
    </div>
  `;
  return tile;
}

function renderPagination() {
  const container = document.getElementById("pagination");
  if (!container) return;
  container.innerHTML = "";

  if (maxPages <= 1) return;

  const createBtn = (text, page, isActive = false, isDisabled = false) => {
    const btn = document.createElement("button");
    btn.className = `page-btn ${isActive ? "active" : ""}`;
    btn.innerHTML = text;
    btn.disabled = isDisabled;
    if (!isDisabled && !isActive)
      btn.addEventListener("click", () => {
        currentPage = page;
        renderResultsPage();
        // Scroll nhẹ lên đầu danh sách
        const resultsHeader = document.querySelector("#results-section h2");
        if (resultsHeader) resultsHeader.scrollIntoView({ behavior: "smooth" });
      });
    return btn;
  };

  // Nút Prev
  container.appendChild(
    createBtn(
      '<i class="fas fa-chevron-left"></i>',
      currentPage - 1,
      false,
      currentPage === 1,
    ),
  );

  // Các nút số
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(maxPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);

  for (let i = start; i <= end; i++) {
    container.appendChild(createBtn(i, i, i === currentPage));
  }

  // Nút Next
  container.appendChild(
    createBtn(
      '<i class="fas fa-chevron-right"></i>',
      currentPage + 1,
      false,
      currentPage === maxPages,
    ),
  );
}

function renderMeta(meta) {
  const box = document.getElementById("metaBox");
  if (!box) return;

  if (!meta) {
    box.innerHTML = '<p style="color:#ccc;">Chưa có thông tin meta.</p>';
    return;
  }

  const name = meta.name || meta.dish_id || "Thông tin món ăn";
  const ingredients = Array.isArray(meta.ingredients) ? meta.ingredients : [];
  const steps = Array.isArray(meta.step) ? meta.step : [];

  box.innerHTML = `
    <h2 class="metaTitle">${name}</h2>
    
    <h3><i class="fas fa-carrot"></i> Nguyên liệu:</h3>
    <ul>${ingredients.map((i) => `<li>${i}</li>`).join("")}</ul>
    
    <h3><i class="fas fa-fire"></i> Cách làm:</h3>
    <div class="meta-step-scroll">
        <ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol>
    </div>
  `;
}
