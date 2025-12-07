// src/flipbookApp.js
import { PageFlip } from "page-flip";
import { renderPdfToImages } from "./pdfService";

/**
 * Khởi tạo flipbook app:
 * - load PDF -> ảnh
 * - PageFlip
 * - toolbar, edge, zoom, drag, dblclick
 */
export async function initFlipbookApp(pdfUrl) {
  const bookElement = document.getElementById("book");
  const wrapper = document.querySelector(".flipbook-wrapper");
  const zoomContainer = document.querySelector(".zoom-container");

  if (!bookElement || !wrapper || !zoomContainer) {
    console.error("Không tìm thấy phần tử flipbook cần thiết.");
    return;
  }

  // 1) Render PDF -> images
  const { images, baseWidth, baseHeight } = await renderPdfToImages(
    pdfUrl,
    1.3
  );

  // 2) Init PageFlip
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

  pageFlip.loadFromImages(images);

  // --- Toolbar & edge controls ---
  const btnFirst = document.getElementById("btn-first");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnZoom = document.getElementById("btn-zoom");

  btnFirst?.addEventListener("click", () => pageFlip.turnToPage(0));
  btnPrev?.addEventListener("click", () => pageFlip.flipPrev("bottom"));
  btnNext?.addEventListener("click", () => pageFlip.flipNext("bottom"));

  const edgeLeft = document.getElementById("edge-left");
  const edgeRight = document.getElementById("edge-right");

  edgeLeft?.addEventListener("click", () => pageFlip.flipPrev("bottom"));
  edgeRight?.addEventListener("click", () => pageFlip.flipNext("bottom"));

  // --- Zoom state ---
  let zoom = 1; // 1x
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;
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

  // Zoom bằng scroll (giữ behavior cũ)
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

  // Zoom 2x quanh center bằng nút 🔍, click lại để reset
  btnZoom?.addEventListener("click", () => {
    if (zoom === 1) {
      // zoom lên 2x và đưa viewport vào giữa nội dung
      zoom = 2;
      applyZoom();

      const rect = wrapper.getBoundingClientRect();
      const totalW = wrapper.scrollWidth || rect.width;
      const totalH = wrapper.scrollHeight || rect.height;

      wrapper.scrollLeft = (totalW - rect.width) / 2;
      wrapper.scrollTop = (totalH - rect.height) / 2;
    } else {
      zoom = 1;
      applyZoom();
    }
  });

  // --- Drag-to-pan khi zoom ---
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  // Bắt đầu kéo (capture để chặn lật trang)
  wrapper.addEventListener(
    "mousedown",
    (e) => {
      if (zoom <= 1) return;
      if (e.button !== 0) return;
      if (e.target.closest(".page-edge")) return; // vẫn cho edge click lật

      isDragging = true;
      wrapper.classList.add("dragging");
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = wrapper.scrollLeft;
      startScrollTop = wrapper.scrollTop;

      e.preventDefault();
      e.stopPropagation();
    },
    true
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

  // Đang zoom thì click vào book không lật trang
  bookElement.addEventListener("click", (e) => {
    if (zoom > 1) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // Double-click: chỉ dùng để thoát zoom (bản bạn chọn)
  bookElement.addEventListener("dblclick", (e) => {
    if (zoom > 1) {
      zoom = 1;
      applyZoom();
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // --- Enable/disable nút khi đầu/cuối ---
  const updateButtons = () => {
    const current = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();

    const atFirst = current === 0;
    const atLast = current === total - 1;

    if (btnFirst) btnFirst.disabled = atFirst;
    if (btnPrev) btnPrev.disabled = atFirst;
    if (btnNext) btnNext.disabled = atLast;

    [btnFirst, btnPrev, btnNext].forEach((btn) => {
      if (!btn) return;
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
  pageFlip.on("flip", updateButtons);
}
