import "./style.css";
import { PageFlip } from "page-flip";

// PDF.js v4 – dùng import chính + worker ?url cho Vite
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Tạo layout vào #app
const app = document.querySelector("#app");

app.innerHTML = `
  <div class="app-title">Flipbook Demo</div>

  <div class="top-toolbar">
    <button class="toolbar-btn" id="btn-first">
      <span class="icon">⏮</span>
    </button>
    <button class="toolbar-btn" id="btn-prev">
      <span class="icon">◀</span>
    </button>
    <button class="toolbar-btn" id="btn-next">
      <span class="icon">▶</span>
    </button>
  </div>

  <div class="flipbook-wrapper">
    <div id="book"></div>

    <!-- Dải dọc điều hướng 2 bên -->
    <div class="page-edge left-edge" id="edge-left">
      <span class="edge-icon">◀</span>
    </div>
    <div class="page-edge right-edge" id="edge-right">
      <span class="edge-icon">▶</span>
    </div>
  </div>
`;

/**
 * Render toàn bộ PDF thành mảng dataURL (PNG)
 */
async function renderPdfToImages(pdfUrl, scale = 1.3) {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;

  const images = [];
  let baseWidth = 600;
  let baseHeight = 800;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    await page.render(renderContext).promise;

    if (pageNum === 1) {
      baseWidth = viewport.width;
      baseHeight = viewport.height;
    }

    const dataUrl = canvas.toDataURL("image/png");
    images.push(dataUrl);
  }

  return { images, baseWidth, baseHeight };
}

async function initFlipbook() {
  // PDF bạn đã để trong thư mục public: /public/business-test.pdf
  const pdfUrl = new URL(
    `${import.meta.env.BASE_URL}business-test.pdf`,
    window.location.origin
  ).href;

  // 1) Render PDF -> ảnh
  const { images, baseWidth, baseHeight } = await renderPdfToImages(
    pdfUrl,
    1.3
  );

  // 2) Khởi tạo PageFlip
  const bookElement = document.getElementById("book");

  const pageFlip = new PageFlip(bookElement, {
    width: baseWidth,
    height: baseHeight,
    size: "stretch",
    minWidth: 300,
    maxWidth: 1600,
    minHeight: 400,
    maxHeight: 1000,
    drawShadow: true,
    flippingTime: 800,
    usePortrait: true,
    autoSize: true,
    maxShadowOpacity: 0.6,
    showCover: true,
    mobileScrollSupport: true,
  });

  // 3) Load từ ảnh
  pageFlip.loadFromImages(images);

  // ===== Gán sự kiện cho toolbar =====
  const btnFirst = document.getElementById("btn-first");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");

  btnFirst.addEventListener("click", () => {
    pageFlip.turnToPage(0);
  });

  btnPrev.addEventListener("click", () => {
    pageFlip.flipPrev("bottom");
  });

  btnNext.addEventListener("click", () => {
    pageFlip.flipNext("bottom");
  });

  // ===== Gán sự kiện cho dải dọc 2 bên =====
  const edgeLeft = document.getElementById("edge-left");
  const edgeRight = document.getElementById("edge-right");

  edgeLeft.addEventListener("click", () => {
    pageFlip.flipPrev("bottom");
  });

  edgeRight.addEventListener("click", () => {
    pageFlip.flipNext("bottom");
  });

  // (Tùy chọn) disable nút khi tới đầu/cuối
  const updateButtons = () => {
    const current = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();

    btnFirst.disabled = current === 0;
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === total - 1;

    [btnFirst, btnPrev, btnNext].forEach((btn) => {
      if (btn.disabled) {
        btn.style.opacity = "0.4";
        btn.style.cursor = "default";
      } else {
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    });
  };

  updateButtons();

  pageFlip.on("flip", () => {
    updateButtons();
  });
}

// Khởi động
initFlipbook().catch((err) => {
  console.error("Lỗi khởi tạo flipbook:", err);
});
