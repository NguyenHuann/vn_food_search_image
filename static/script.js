// ================================================================
// 1. SLIDER LOGIC (BANNER TRANG CHỦ)
// ================================================================
let slideIndex = 1;
let intervalId;
const intervalTime = 3000;

function showSlides(n) {
    let slides = document.getElementsByClassName("slides");
    let dots = document.getElementsByClassName("dot");

    if (!slides.length) return;

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

// Khởi chạy slider khi trang load xong
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementsByClassName("slides").length > 0) {
        showSlides(slideIndex);
        startInterval();
    }
});


// ================================================================
// 2. BACKGROUND MOTION CANVAS (HIỆU ỨNG HẠT)
// ================================================================
(function initCanvas() {
    const canvas = document.getElementById('motion-canvas');
    if (!canvas) return; // Nếu không có canvas thì bỏ qua

    const ctx = canvas.getContext('2d');
    
    // Cấu hình: Màu hạt (Tím nhạt theme #6c63ff)
    const config = {
        starColor: 'rgba(108, 99, 255, 0.5)', 
        lineColor: 'rgba(108, 99, 255, 0.15)',
        amount: 80, 
        speed: 0.5,
        linkRadius: 150
    };

    let w, h, stars = [];

    const resize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

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
        for(let i = 0; i < config.amount; i++) {
            stars.push(new Star());
        }
    }

    const animate = () => {
        ctx.clearRect(0, 0, w, h);
        for(let i = 0; i < stars.length; i++) {
            stars[i].update();
            stars[i].draw();
            for(let j = i; j < stars.length; j++) {
                const dx = stars[i].x - stars[j].x;
                const dy = stars[i].y - stars[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < config.linkRadius) {
                    ctx.beginPath();
                    ctx.moveTo(stars[i].x, stars[i].y);
                    ctx.lineTo(stars[j].x, stars[j].y);
                    ctx.strokeStyle = config.lineColor;
                    ctx.lineWidth = 1 - dist/config.linkRadius;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => { resize(); init(); });
    init();
    animate();
})();


// ================================================================
// 3. MAIN LOGIC (TÌM KIẾM ẢNH)
// ================================================================

const DEFAULT_BACKEND = "http://127.0.0.1:7860";
const urlParams = new URLSearchParams(location.search);
const BASE_URL = urlParams.get("backend") || DEFAULT_BACKEND;

// DOM helpers
const $ = (q) => document.querySelector(q);

// Elements
const elDrop = $("#drop");
const elPrev = $("#preview");
const elPrevImg = $("#previewImg");
const elErr = $("#err");
const elLoading = $("#loading"); // Overlay Loading

// Buttons & Inputs
const btnCamera = $("#btnCamera");
const btnUpload = $("#btnUpload");
const fileInputCamera = $("#fileCamera");
const fileInputUpload = $("#fileUpload");
const elBtnSearch = $("#btnSearch");
const elBtnClear = $("#btnClear");

// Sections
const sectionTraining = $(".training-section"); // Màn hình upload
const sectionResults = $("#results-section");   // Màn hình kết quả
const elMainGrid = $("#related-results-grid");

// Variables
let fileBlob = null;
let allResults = [];
let currentPage = 1;
const perPage = 12;
let maxPages = 1;

// Helper: Hiển thị lỗi
const setError = (msg) => {
    if (elErr) {
        elErr.style.display = msg ? "block" : "none";
        elErr.textContent = msg || "";
    }
};

const makeImgUrl = (relPath) => `${BASE_URL}/dataset/${relPath}`;

// --- EVENT LISTENERS: INPUT ẢNH ---

// --- CÁC BIẾN MỚI CHO CAMERA LAPTOP ---
const elCameraModal = document.getElementById('camera-modal');
const elVideo = document.getElementById('video-feed');
const elCanvas = document.getElementById('canvas-capture');
const btnSnap = document.getElementById('btn-snap');
const btnCloseCamera = document.getElementById('btn-close-camera');
let videoStream = null;

// --- HÀM KIỂM TRA THIẾT BỊ DI ĐỘNG ---
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// --- 1. SỬA LẠI SỰ KIỆN CLICK NÚT CAMERA ---
if (btnCamera) {
    btnCamera.addEventListener("click", () => {
        if (isMobileDevice()) {
            // Nếu là điện thoại -> Dùng input mặc định (tốt hơn trên mobile)
            fileInputCamera.click();
        } else {
            // Nếu là Laptop/PC -> Mở modal camera tùy chỉnh
            startCamera();
        }
    });
}

// Giữ nguyên sự kiện change của input camera cho trường hợp mobile
if (fileInputCamera) {
    fileInputCamera.addEventListener("change", (e) => handleFileSelect(e.target.files?.[0]));
}

// --- CÁC HÀM XỬ LÝ WEBCAM ---

// Hàm khởi động Camera
async function startCamera() {
    try {
        elCameraModal.style.display = 'flex';
        // Yêu cầu quyền truy cập Camera
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        elVideo.srcObject = videoStream;
    } catch (err) {
        console.error("Không thể mở camera:", err);
        alert("Không thể truy cập Camera. Vui lòng kiểm tra quyền truy cập hoặc sử dụng nút 'Tải ảnh'.");
        closeCamera();
        // Fallback: Nếu lỗi thì mở chọn file bình thường
        fileInputCamera.click(); 
    }
}

// Hàm tắt Camera
function closeCamera() {
    elCameraModal.style.display = 'none';
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

// Hàm Chụp ảnh từ Video
btnSnap.addEventListener("click", () => {
    if (!videoStream) return;

    // 1. Vẽ hình từ video lên canvas
    const context = elCanvas.getContext('2d');
    elCanvas.width = elVideo.videoWidth;
    elCanvas.height = elVideo.videoHeight;
    context.drawImage(elVideo, 0, 0, elCanvas.width, elCanvas.height);

    // 2. Chuyển Canvas thành File ảnh
    elCanvas.toBlob((blob) => {
        if (blob) {
            // Tạo một file giả lập từ blob
            const file = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
            
            // Gọi hàm xử lý chính của bạn
            handleFileSelect(file);
            
            // Tắt camera sau khi chụp
            closeCamera();
        }
    }, 'image/jpeg', 0.95);
});

// Nút Đóng
btnCloseCamera.addEventListener("click", closeCamera);

// Đóng khi click ra ngoài vùng video
elCameraModal.addEventListener("click", (e) => {
    if (e.target === elCameraModal) closeCamera();
});


// Hàm xử lý file được chọn
// Khi bấm btnUpload -> Tự động kích hoạt click cho fileInputUpload (cái đã bị ẩn)
btnUpload.addEventListener("click", () => fileInputUpload.click());
function handleFileSelect(file) {
    setError("");
    if (!file) return;

    // Validate
    if (!/\.(jpg|jpeg|png|bmp|webp)$/i.test(file.name)) {
        setError("Định dạng file không hợp lệ. Vui lòng chọn ảnh.");
        return;
    }

    fileBlob = file;
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        elPrevImg.src = e.target.result;
        elPrev.style.display = "block";
    };
    reader.readAsDataURL(file);

    // Enable Search button
    elBtnSearch.disabled = false;
}


// --- [QUAN TRỌNG] XỬ LÝ NÚT TÌM KIẾM ---
if (elBtnSearch) {
    elBtnSearch.addEventListener("click", async () => {
        if (!fileBlob) return;

        setError("");
        elBtnSearch.disabled = true;
        
        // 1. HIỆN LOADING
        if (elLoading) elLoading.style.display = "flex"; 

        try {
            const fd = new FormData();
            fd.append("image", fileBlob);

            const resp = await fetch(`${BASE_URL}/search`, {
                method: "POST",
                body: fd,
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Lỗi (${resp.status}): ${text}`);
            }

            const data = await resp.json();
            if (!data.results) throw new Error("Dữ liệu không hợp lệ.");

            // 2. Cập nhật Sidebar & Metadata
            const queryImg = document.getElementById("queryImgDisplay");
            if (queryImg) queryImg.src = elPrevImg.src;
            renderMeta(data.meta);

            // 3. Xử lý kết quả
            const sameList = (data.results.same_dish || []).map(i => ({...i, isCorrect: true}));
            const relatedList = (data.results.related || []).map(i => ({...i, isCorrect: false}));
            
            allResults = [...sameList, ...relatedList];
            allResults.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

            maxPages = Math.ceil(allResults.length / perPage) || 1;
            currentPage = 1;

            renderResultsPage();

            // 4. CHUYỂN ĐỔI GIAO DIỆN (Ẩn Upload -> Hiện Kết quả)
            if (sectionTraining) sectionTraining.style.display = "none";
            if (sectionResults) sectionResults.style.display = "block";
            
            sectionResults.scrollIntoView({ behavior: "smooth" });

        } catch (err) {
            console.error(err);
            setError("Lỗi: " + err.message);
            elBtnSearch.disabled = false;
        } finally {
            // 5. ẨN LOADING
            if (elLoading) elLoading.style.display = "none";
        }
    });
}


// --- [QUAN TRỌNG] XỬ LÝ NÚT LÀM MỚI (RESET) ---
// Sử dụng reload để fix lỗi vỡ giao diện
if (elBtnClear) {
    elBtnClear.addEventListener("click", () => {
        window.location.reload();
    });
}


// ================================================================
// 4. RENDER FUNCTIONS
// ================================================================

function renderResultsPage() {
    elMainGrid.innerHTML = "";
    
    if (allResults.length === 0) {
        elMainGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#fff;padding:20px;">Không tìm thấy kết quả nào.</div>';
        return;
    }

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageData = allResults.slice(start, end);

    pageData.forEach((item) => {
        elMainGrid.appendChild(createImageTile(item));
    });

    renderPagination();
}

function createImageTile(item) {
    const url = makeImgUrl(item.path);
    const score = Number(item.distance ?? 0).toFixed(3);
    
    const tile = document.createElement("div");
    tile.className = "tile";
    if (item.isCorrect) tile.classList.add("correct-match");

    tile.innerHTML = `
        <img src="${url}" loading="lazy" alt="Food Image" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'"/>
        ${item.isCorrect ? '<span class="badge">Chính xác</span>' : ''}
        <div class="meta">
            <span>Score: ${score}</span>
            <a href="${url}" target="_blank">Xem</a>
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
        btn.className = `page-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = text;
        btn.disabled = isDisabled;
        if (!isDisabled && !isActive) {
            btn.addEventListener("click", () => {
                currentPage = page;
                renderResultsPage();
                document.querySelector(".results-panel").scrollIntoView({behavior: "smooth"});
            });
        }
        return btn;
    };

    container.appendChild(createBtn('<i class="fas fa-chevron-left"></i>', currentPage - 1, false, currentPage === 1));

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(maxPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        container.appendChild(createBtn(i, i, i === currentPage));
    }

    container.appendChild(createBtn('<i class="fas fa-chevron-right"></i>', currentPage + 1, false, currentPage === maxPages));
}

function renderMeta(meta) {
    const box = document.getElementById("metaBox");
    if (!box) return;

    if (!meta) {
        box.innerHTML = '<p style="color:#ccc;">Chưa có thông tin.</p>';
        return;
    }

    const name = meta.name || meta.dish_id || "Món ăn";
    const ingredients = Array.isArray(meta.ingredients) ? meta.ingredients : [];
    const steps = Array.isArray(meta.step) ? meta.step : [];

    box.innerHTML = `
        <h2 class="metaTitle">${name}</h2>
        <h3><i class="fas fa-carrot"></i> Nguyên liệu:</h3>
        <ul>
            ${ingredients.length ? ingredients.map(i => `<li>${i}</li>`).join('') : '<li>Đang cập nhật...</li>'}
        </ul>
        <h3><i class="fas fa-fire"></i> Cách làm:</h3>
        <div class="meta-step-scroll">
            <ol>
                ${steps.length ? steps.map(s => `<li>${s}</li>`).join('') : '<li>Đang cập nhật...</li>'}
            </ol>
        </div>
    `;
}