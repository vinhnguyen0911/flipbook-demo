// src/flipbookApp.js
import { PageFlip } from "page-flip";
import { loadPdf, renderPdfPages } from "./pdfService";

/**
 * Khởi tạo flipbook:
 *  - Render 4 trang đầu → hiển thị ngay sau khi xong
 *  - Hiện spinner trong lúc render
 *  - Preload các trang còn lại ở background
 *  - Giữ nguyên zoom / drag / dblclick
 */
export async function initFlipbookApp(pdfUrl) {
  const bookElement = document.getElementById("book");
  const wrapper = document.querySelector(".flipbook-wrapper");
  const zoomContainer = document.querySelector(".zoom-container");

  if (!bookElement || !wrapper || !zoomContainer) {
    console.error("Không đủ phần tử để tạo flipbook");
    return;
  }

  // 1) Load PDF
  const pdf = await loadPdf(pdfUrl);
  const totalPages = pdf.numPages;

  // 2) Render 4 trang đầu — đủ để flipbook chạy mượt
  const INITIAL_PAGES = Math.min(4, totalPages);
  const RENDER_SCALE = 1.0;

  const {
    images: firstImages,
    baseWidth,
    baseHeight,
  } = await renderPdfPages(pdf, 1, INITIAL_PAGES, RENDER_SCALE);

  // Mảng ảnh dùng cho PageFlip
  const allImages = [...firstImages];

  // 3) Init PageFlip
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
    disableFlipByClick: false, // click để lật khi không zoom
  });

  // Load flipbook bằng 4 trang đầu
  pageFlip.loadFromImages(allImages);

  // ================== PRELOAD ==================
  let preloadBuffer = [];
  let isUserFlipping = false;
  let updateScheduled = false;

  // Khi user flip → đánh dấu đang flip
  pageFlip.on("flip", () => {
    isUserFlipping = true;
    setTimeout(() => {
      isUserFlipping = false;
      maybeUpdateFromBuffer();
    }, 300);
  });

  // gom update vào 1 lần khi idle
  function maybeUpdateFromBuffer() {
    if (isUserFlipping) return;
    if (updateScheduled) return;
    if (preloadBuffer.length === 0) return;

    updateScheduled = true;

    setTimeout(() => {
      allImages.push(...preloadBuffer);
      preloadBuffer = [];
      pageFlip.updateFromImages(allImages);
      updateScheduled = false;
    }, 250);
  }

  async function preloadRemainingPages() {
    if (INITIAL_PAGES >= totalPages) return;

    for (let pageNum = INITIAL_PAGES + 1; pageNum <= totalPages; pageNum++) {
      try {
        const { images } = await renderPdfPages(
          pdf,
          pageNum,
          pageNum,
          RENDER_SCALE
        );
        preloadBuffer.push(images[0]);
        maybeUpdateFromBuffer();
      } catch (err) {
        console.error("Lỗi preload trang:", pageNum, err);
      }
    }
  }

  preloadRemainingPages();

  // =============== TOOLBAR & EDGE ===============
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

  // =============== ZOOM ===============
  let zoom = 1;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.1;

  function applyZoom() {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

    zoomContainer.style.width = `${zoom * 100}%`;
    zoomContainer.style.height = `${zoom * 100}%`;

    if (zoom > 1) wrapper.classList.add("zoomed");
    else wrapper.classList.remove("zoomed");

    if (zoom === 1) {
      wrapper.scrollLeft = 0;
      wrapper.scrollTop = 0;
      zoomContainer.style.width = "100%";
      zoomContainer.style.height = "100%";
    }

    setTimeout(() => window.dispatchEvent(new Event("resize")), 30);
  }

  wrapper.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom += e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyZoom();
    },
    { passive: false }
  );

  btnZoom?.addEventListener("click", () => {
    if (zoom === 1) {
      zoom = 2;
      applyZoom();
      const rect = wrapper.getBoundingClientRect();
      wrapper.scrollLeft = (wrapper.scrollWidth - rect.width) / 2;
      wrapper.scrollTop = (wrapper.scrollHeight - rect.height) / 2;
    } else {
      zoom = 1;
      applyZoom();
    }
  });

  // =============== DRAG ===============
  let isDragging = false;
  let startX, startY, startScrollLeft, startScrollTop;

  wrapper.addEventListener(
    "mousedown",
    (e) => {
      if (zoom <= 1 || e.button !== 0) return;
      if (e.target.closest(".page-edge")) return;

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
    wrapper.scrollLeft = startScrollLeft - (e.clientX - startX);
    wrapper.scrollTop = startScrollTop - (e.clientY - startY);
  });

  ["mouseup", "mouseleave"].forEach((evt) =>
    wrapper.addEventListener(evt, () => {
      isDragging = false;
      wrapper.classList.remove("dragging");
    })
  );

  // =============== DOUBLE CLICK EXIT ZOOM ===============
  bookElement.addEventListener("dblclick", (e) => {
    if (zoom > 1) {
      zoom = 1;
      applyZoom();
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // =============== CẬP NHẬT NÚT ===============
  function updateButtons() {
    const curr = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();

    const atFirst = curr === 0;
    const atLast = curr === total - 1;

    if (btnFirst) btnFirst.disabled = atFirst;
    if (btnPrev) btnPrev.disabled = atFirst;
    if (btnNext) btnNext.disabled = atLast;

    [btnFirst, btnPrev, btnNext].forEach((btn) => {
      if (!btn) return;
      btn.style.opacity = btn.disabled ? "0.4" : "1";
      btn.style.cursor = btn.disabled ? "default" : "pointer";
    });
  }

  updateButtons();
  pageFlip.on("flip", updateButtons);
}
