// =========================
// Load phần HEADER
// =========================
fetch("Layout/header.html")
  .then(res => res.text())
  .then(data => {
    // Chèn header vào trang
    document.getElementById("header").innerHTML = data;

    // Sau khi chèn xong -> xử lý tô sáng trang đang active
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // Kiểm tra tất cả link trong menu
    document.querySelectorAll("#header nav a").forEach(a => {
      if (a.getAttribute("href") === currentPage) {
        a.classList.add("active");
      } else {
        a.classList.remove("active");
      }
    });
  })
  .catch(err => console.error("Lỗi khi tải header:", err));

// 

// =========================
// Load phần FOOTER
// =========================
fetch("Layout/footer.html")
  .then(res => res.text())
  .then(data => {
    // Chèn footer vào trang
    document.getElementById("footer").innerHTML = data;
  })
  .catch(err => console.error("Lỗi khi tải footer:", err));
