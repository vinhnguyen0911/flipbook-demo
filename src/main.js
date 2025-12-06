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
    <button class="toolbar-btn" id="btn-zoom">
      <span class="icon">🔍</span>
    </button>
  </div>

  <div class="flipbook-wrapper">
    <div class="zoom-container">
      <div id="book"></div>
    </div>

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
  // PDF trong /public
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
  const wrapper = document.querySelector(".flipbook-wrapper");
  const zoomContainer = document.querySelector(".zoom-container");

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

  // ===== Toolbar =====
  const btnFirst = document.getElementById("btn-first");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnZoom = document.getElementById("btn-zoom");

  btnFirst.addEventListener("click", () => {
    pageFlip.turnToPage(0);
  });

  btnPrev.addEventListener("click", () => {
    pageFlip.flipPrev("bottom");
  });

  btnNext.addEventListener("click", () => {
    pageFlip.flipNext("bottom");
  });

  // ===== Dải dọc 2 bên =====
  const edgeLeft = document.getElementById("edge-left");
  const edgeRight = document.getElementById("edge-right");

  edgeLeft.addEventListener("click", () => {
    pageFlip.flipPrev("bottom");
  });

  edgeRight.addEventListener("click", () => {
    pageFlip.flipNext("bottom");
  });

  // ===== Zoom state =====
  let zoom = 1; // 100%
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3; // ⭐ đổi lên 3x
  const ZOOM_STEP = 0.1;

  function applyZoom() {
    if (zoom < MIN_ZOOM) zoom = MIN_ZOOM;
    if (zoom > MAX_ZOOM) zoom = MAX_ZOOM;

    zoomContainer.style.width = `${zoom * 100}%`;
    zoomContainer.style.height = `${zoom * 100}%`;

    if (zoom > 1) {
      wrapper.classList.add("zoomed");
    } else {
      wrapper.classList.remove("zoomed");
      wrapper.scrollLeft = 0;
      wrapper.scrollTop = 0;
      zoomContainer.style.width = "100%";
      zoomContainer.style.height = "100%";
    }

    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
  }

  /**
   * Zoom tới một mức `targetZoom`.
   * Nếu có `event`, zoom quanh vùng click;
   * nếu không, zoom quanh center viewport.
   */
  function zoomTo(targetZoom, event) {
    if (targetZoom < MIN_ZOOM) targetZoom = MIN_ZOOM;
    if (targetZoom > MAX_ZOOM) targetZoom = MAX_ZOOM;

    const rect = wrapper.getBoundingClientRect();

    // Tính tỷ lệ vị trí (ratioX/Y) trên toàn bộ nội dung trước khi zoom
    const beforeScrollWidth = wrapper.scrollWidth || rect.width;
    const beforeScrollHeight = wrapper.scrollHeight || rect.height;

    let ratioX = 0.5;
    let ratioY = 0.5;

    if (event) {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const contentX = wrapper.scrollLeft + x;
      const contentY = wrapper.scrollTop + y;

      ratioX = contentX / beforeScrollWidth;
      ratioY = contentY / beforeScrollHeight;
    } else {
      const centerX = wrapper.scrollLeft + rect.width / 2;
      const centerY = wrapper.scrollTop + rect.height / 2;

      ratioX = centerX / beforeScrollWidth;
      ratioY = centerY / beforeScrollHeight;
    }

    zoom = targetZoom;
    applyZoom();

    // Sau khi zoom, cập nhật scroll sao cho vùng đó gần center
    const afterScrollWidth = wrapper.scrollWidth || rect.width;
    const afterScrollHeight = wrapper.scrollHeight || rect.height;

    wrapper.scrollLeft = ratioX * afterScrollWidth - rect.width / 2;
    wrapper.scrollTop = ratioY * afterScrollHeight - rect.height / 2;
  }

  // Zoom bằng scroll chuột
  wrapper.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      if (event.deltaY < 0) {
        zoom += ZOOM_STEP;
      } else {
        zoom -= ZOOM_STEP;
      }

      applyZoom();
    },
    { passive: false }
  );

  // Nút Zoom: zoom 2x quanh center (double click để thoát)
  btnZoom.addEventListener("click", () => {
    if (zoom === 1) {
      zoomTo(2, null); // zoom 2x quanh center
    } else {
      // optional: click lần nữa thoát zoom
      zoom = 1;
      applyZoom();
    }
  });

  // ===== Drag-to-pan khi đang zoom (scrollLeft/Top) =====
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  // Bắt đầu kéo (capture để chặn PageFlip lật trang)
  wrapper.addEventListener(
    "mousedown",
    (e) => {
      if (zoom <= 1) return; // chỉ drag khi zoom
      if (e.button !== 0) return; // chỉ chuột trái
      if (e.target.closest(".page-edge")) return; // edge vẫn lật trang

      isDragging = true;
      wrapper.classList.add("dragging");
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = wrapper.scrollLeft;
      startScrollTop = wrapper.scrollTop;

      e.preventDefault();
      e.stopPropagation();
    },
    true // capture
  );

  wrapper.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    wrapper.scrollLeft = startScrollLeft - dx;
    wrapper.scrollTop = startScrollTop - dy;
  });

  ["mouseup", "mouseleave"].forEach((evt) => {
    wrapper.addEventListener(evt, () => {
      isDragging = false;
      wrapper.classList.remove("dragging");
    });
  });

  // Chặn click lật trang khi đang zoom
  bookElement.addEventListener("click", (e) => {
    if (zoom > 1) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // Double click:
  // - Nếu đang zoom: thoát zoom
  // - Nếu chưa zoom: zoom 2x quanh vùng click
  bookElement.addEventListener("dblclick", (e) => {
    if (zoom > 1) {
      zoom = 1;
      applyZoom();
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // ===== Disable nút khi ở đầu/cuối =====
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
