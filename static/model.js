// Modal functionality
const createCollectionBtn = document.getElementById("createCollectionBtn");
const createCollectionModal = document.getElementById("createCollectionModal");
const closeModalBtn = document.querySelector(".close-modal");
const cancelBtn = document.querySelector(".btn-cancel");
const createCollectionForm = document.getElementById("createCollectionForm");

createCollectionBtn.addEventListener("click", () => {
  createCollectionModal.style.display = "flex";
});

const closeModal = () => {
  createCollectionModal.style.display = "none";
};

closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

createCollectionModal.addEventListener("click", (e) => {
  if (e.target === createCollectionModal) {
    closeModal();
  }
});

createCollectionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const collectionName = document.getElementById("collectionName").value;
  alert(`Đã tạo bộ sưu tập: ${collectionName}`);
  closeModal();
  createCollectionForm.reset();
});

// Xử lý nút chia sẻ và chỉnh sửa
document.querySelectorAll(".collection-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    const action = this.querySelector("i").className;
    const collectionName =
      this.closest(".collection-card").querySelector("h4").textContent;

    if (action.includes("share-alt")) {
      alert(`Chia sẻ bộ sưu tập: ${collectionName}`);
    } else if (action.includes("edit")) {
      alert(`Chỉnh sửa bộ sưu tập: ${collectionName}`);
    }
  });
});
