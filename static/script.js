
// ================================================================
// 1. BACKGROUND MOTION CANVAS (HIỆU ỨNG HẠT)
// ================================================================
(function initCanvas() {
    const canvas = document.getElementById('motion-canvas');
    if (!canvas) return; 

    const ctx = canvas.getContext('2d');
    const config = { starColor: 'rgba(108, 99, 255, 0.5)', lineColor: 'rgba(108, 99, 255, 0.15)', amount: 80, speed: 0.5, linkRadius: 150 };
    let w, h, stars = [];

    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    class Star {
        constructor() { this.x = Math.random() * w; this.y = Math.random() * h; this.vx = (Math.random() - 0.5) * config.speed; this.vy = (Math.random() - 0.5) * config.speed; this.size = Math.random() * 2 + 1; }
        update() { this.x += this.vx; this.y += this.vy; if (this.x < 0 || this.x > w) this.vx *= -1; if (this.y < 0 || this.y > h) this.vy *= -1; }
        draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = config.starColor; ctx.fill(); }
    }
    const init = () => { resize(); stars = []; for(let i = 0; i < config.amount; i++) stars.push(new Star()); }
    const animate = () => {
        ctx.clearRect(0, 0, w, h);
        for(let i = 0; i < stars.length; i++) {
            stars[i].update(); stars[i].draw();
            for(let j = i; j < stars.length; j++) {
                const dx = stars[i].x - stars[j].x; const dy = stars[i].y - stars[j].y; const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < config.linkRadius) { ctx.beginPath(); ctx.moveTo(stars[i].x, stars[i].y); ctx.lineTo(stars[j].x, stars[j].y); ctx.strokeStyle = config.lineColor; ctx.lineWidth = 1 - dist/config.linkRadius; ctx.stroke(); }
            }
        }
        requestAnimationFrame(animate);
    }
    window.addEventListener('resize', () => { resize(); init(); });
    init(); animate();
})();

// ================================================================
// 2. MAIN LOGIC (TÌM KIẾM ẢNH)
// ================================================================
const DEFAULT_BACKEND = "http://127.0.0.1:7860";
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

const setError = (msg) => { if (elErr) { elErr.style.display = msg ? "block" : "none"; elErr.textContent = msg || ""; } };
const makeImgUrl = (relPath) => `${BASE_URL}/dataset/${relPath}`;

// --- CÁC BIẾN CHO CAMERA LAPTOP ---
const elCameraModal = document.getElementById('camera-modal');
const elVideo = document.getElementById('video-feed');
const elCanvas = document.getElementById('canvas-capture');
const btnSnap = document.getElementById('btn-snap');
const btnCloseCamera = document.getElementById('btn-close-camera');
let videoStream = null;

function isMobileDevice() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); }

// --- [ĐÃ SỬA] XỬ LÝ SỰ KIỆN NÚT BẤM (DÙNG stopPropagation ĐỂ CHẶN BUBBLING) ---

// 1. NÚT CAMERA
if (btnCamera) {
    btnCamera.addEventListener("click", (e) => {
        e.stopPropagation(); // <--- CHẶN NỔI BỌT RA NGOÀI
        if (isMobileDevice()) {
            fileInputCamera.click();
        } else {
            startCamera();
        }
    });
}
if (fileInputCamera) {
    fileInputCamera.addEventListener("change", (e) => handleFileSelect(e.target.files?.[0]));
}

// 2. NÚT UPLOAD
if (btnUpload) {
    btnUpload.addEventListener("click", (e) => {
        e.stopPropagation(); // <--- CHẶN NỔI BỌT RA NGOÀI
        if (fileInputUpload) fileInputUpload.click();
    });
}
if (fileInputUpload) {
    fileInputUpload.addEventListener("change", (e) => handleFileSelect(e.target.files?.[0]));
}

// 3. XỬ LÝ DRAG & DROP (ĐÃ XÓA SỰ KIỆN CLICK GÂY LỖI)
if (elDrop) {
    ["dragenter", "dragover"].forEach(ev => elDrop.addEventListener(ev, (e) => {
        e.preventDefault(); elDrop.classList.add("hover");
    }));
    ["dragleave", "drop"].forEach(ev => elDrop.addEventListener(ev, (e) => {
        e.preventDefault(); elDrop.classList.remove("hover");
    }));
    elDrop.addEventListener("drop", (e) => {
        handleFileSelect(e.dataTransfer?.files?.[0]);
    });
    
    // ĐÃ XÓA: elDrop.addEventListener("click", ...) -> Xóa dòng này đi để hết lỗi bấm 2 lần
}

// --- CÁC HÀM CAMERA ---
async function startCamera() {
    try {
        if (elCameraModal) elCameraModal.style.display = 'flex';
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (elVideo) elVideo.srcObject = videoStream;
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Không thể truy cập Camera. Vui lòng kiểm tra quyền.");
        closeCamera();
    }
}
function closeCamera() {
    if (elCameraModal) elCameraModal.style.display = 'none';
    if (videoStream) { videoStream.getTracks().forEach(track => track.stop()); videoStream = null; }
}
if (btnSnap) {
    btnSnap.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!videoStream) return;
        const context = elCanvas.getContext('2d');
        elCanvas.width = elVideo.videoWidth; elCanvas.height = elVideo.videoHeight;
        context.drawImage(elVideo, 0, 0, elCanvas.width, elCanvas.height);
        elCanvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
                handleFileSelect(file);
                closeCamera();
            }
        }, 'image/jpeg', 0.95);
    });
}
if (btnCloseCamera) btnCloseCamera.addEventListener("click", (e) => { e.stopPropagation(); closeCamera(); });


// --- XỬ LÝ FILE ---
function handleFileSelect(file) {
    setError(""); 
    if (!file) return;
    if (fileInputUpload) fileInputUpload.value = ''; 
    if (fileInputCamera) fileInputCamera.value = '';

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) { setError("Định dạng file không hợp lệ."); return; }

    fileBlob = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        elPrevImg.src = e.target.result;
        elPrev.style.display = "block";
        // Ẩn 2 nút lớn đi để giao diện gọn hơn
        document.querySelector('.big-actions').style.display = 'none';
        
        // Hiện nút Search
        document.querySelector('.search-actions').style.display = 'flex';
        elBtnSearch.disabled = false;
        
        elPrev.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    reader.readAsDataURL(file);
}
// --- XỬ LÝ NÚT TÌM KIẾM (LOGIC TUẦN TỰ - ĐẢM BẢO KHÔNG BỊ CẮT NGANG) ---
if (elBtnSearch) {
    elBtnSearch.addEventListener("click", async (e) => {
        e.stopPropagation(); 
        if (!fileBlob) return;
        
        setError("");
        elBtnSearch.disabled = true;
        
        // Hiện khung loading
        if (elLoading) {
            elLoading.style.display = "flex";
            // Reset text ban đầu
            const textSpan = elLoading.querySelector("span");
            if(textSpan) textSpan.textContent = "Đang khởi tạo...";
        }

        try {
            const fd = new FormData();
            fd.append("image", fileBlob);

            // 1. GỌI API (CHẠY NGẦM)
            // Chúng ta không dùng 'await' ở đây ngay, để nó chạy nền
            const fetchPromise = fetch(`${BASE_URL}/search`, { method: "POST", body: fd });

            // 2. CHẠY HIỆU ỨNG LOADING (CHẠY TUẦN TỰ)
            // Bắt buộc phải chờ hiện xong từng câu, không được nhảy cóc
            const textSpan = elLoading.querySelector("span");
            
            const messages = [
                "Đang tải ảnh lên máy chủ...",      // Hiện 2 giây
                "AI đang trích xuất đặc trưng...",  // Hiện 2.5 giây
                "Đang so khớp với Dataset...",      // Hiện 2.5 giây
                "Đang tổng hợp kết quả..."          // Hiện 1 giây cuối
            ];

            const delays = [2000, 2500, 2500, 1000]; // Thời gian cho từng câu

            // Vòng lặp hiển thị từng tin nhắn
            for (let i = 0; i < messages.length; i++) {
                if(textSpan) textSpan.textContent = messages[i];
                // Bắt buộc chương trình dừng lại chờ, không được làm gì khác
                await new Promise(resolve => setTimeout(resolve, delays[i]));
            }

            // 3. LÚC NÀY MỚI KIỂM TRA KẾT QUẢ API
            // (Nếu API xong sớm thì nó đã chờ sẵn ở dòng await trên. Nếu chưa xong thì giờ chờ nốt)
            const resp = await fetchPromise;

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Lỗi (${resp.status}): ${text}`);
            }

            const data = await resp.json();
            if (!data.results) throw new Error("Dữ liệu không hợp lệ.");

            // --- XỬ LÝ HIỂN THỊ KẾT QUẢ ---
            const queryImg = document.getElementById("queryImgDisplay");
            if (queryImg) queryImg.src = elPrevImg.src;
            renderMeta(data.meta);

            const sameList = (data.results.same_dish || []).map(i => ({...i, isCorrect: true}));
            const relatedList = (data.results.related || []).map(i => ({...i, isCorrect: false}));
            
            allResults = [...sameList, ...relatedList];
            allResults.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

            maxPages = Math.ceil(allResults.length / perPage) || 1;
            currentPage = 1;

            renderResultsPage();

            if (sectionTraining) sectionTraining.style.display = "none";
            if (sectionResults) sectionResults.style.display = "block";
            sectionResults.scrollIntoView({ behavior: "smooth" });

        } catch (err) {
            console.error(err);
            setError("Lỗi: " + err.message);
            elBtnSearch.disabled = false;
        } finally {
            // Tắt loading
            if (elLoading) elLoading.style.display = "none";
            if (elBtnSearch) elBtnSearch.disabled = false;
        }
    });
}

// (Bạn có thể xóa các hàm startLoadingSimulation / stopLoadingSimulation cũ đi vì logic đã nằm hết ở trên rồi)

// --- NÚT LÀM MỚI ---
if (elBtnClear) {
    elBtnClear.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.reload();
    });
}

// --- RENDER FUNCTIONS (Giữ nguyên) ---
function renderResultsPage() {
    elMainGrid.innerHTML = "";
    if (allResults.length === 0) { elMainGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#fff;">Không tìm thấy kết quả.</div>'; return; }
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageData = allResults.slice(start, end);
    pageData.forEach((item) => elMainGrid.appendChild(createImageTile(item)));
    renderPagination();
}

function createImageTile(item) {
    const url = makeImgUrl(item.path);
    const score = Number(item.distance ?? 0).toFixed(3);
    const tile = document.createElement("div"); tile.className = "tile";
    if (item.isCorrect) tile.classList.add("correct-match");
    tile.innerHTML = `<img src="${url}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x200?text=Error'"/>${item.isCorrect ? '<span class="badge">Chính xác</span>' : ''}<div class="meta"><span>Score: ${score}</span><a href="${url}" target="_blank">Xem</a></div>`;
    return tile;
}

function renderPagination() {
    const container = document.getElementById("pagination"); if (!container) return; container.innerHTML = ""; if (maxPages <= 1) return;
    const createBtn = (text, page, isActive = false, isDisabled = false) => {
        const btn = document.createElement("button"); btn.className = `page-btn ${isActive ? 'active' : ''}`; btn.innerHTML = text; btn.disabled = isDisabled;
        if (!isDisabled && !isActive) btn.addEventListener("click", () => { currentPage = page; renderResultsPage(); document.querySelector(".results-panel").scrollIntoView({behavior: "smooth"}); });
        return btn;
    };
    container.appendChild(createBtn('<i class="fas fa-chevron-left"></i>', currentPage - 1, false, currentPage === 1));
    let start = Math.max(1, currentPage - 2); let end = Math.min(maxPages, start + 4); if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) container.appendChild(createBtn(i, i, i === currentPage));
    container.appendChild(createBtn('<i class="fas fa-chevron-right"></i>', currentPage + 1, false, currentPage === maxPages));
}

function renderMeta(meta) {
    const box = document.getElementById("metaBox"); if (!box) return; if (!meta) { box.innerHTML = '<p style="color:#ccc;">Chưa có thông tin.</p>'; return; }
    const name = meta.name || meta.dish_id || "Món ăn";
    const ingredients = Array.isArray(meta.ingredients) ? meta.ingredients : [];
    const steps = Array.isArray(meta.step) ? meta.step : [];
    box.innerHTML = `<h2 class="metaTitle">${name}</h2><h3><i class="fas fa-carrot"></i> Nguyên liệu:</h3><ul>${ingredients.map(i => `<li>${i}</li>`).join('')}</ul><h3><i class="fas fa-fire"></i> Cách làm:</h3><div class="meta-step-scroll"><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;
}