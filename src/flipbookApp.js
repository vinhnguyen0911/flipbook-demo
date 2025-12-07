// src/flipbookApp.js
import { PageFlip } from "page-flip";
import { loadPdf, renderPdfPages } from "./pdfService";

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

  // -------- Phase 1: RENDER 8 TRANG ĐẦU --------
  const INITIAL_PAGES = Math.min(8, totalPages);
  const RENDER_SCALE = 1.0;

  const {
    images: firstImages,
    baseWidth,
    baseHeight,
  } = await renderPdfPages(pdf, 1, INITIAL_PAGES, RENDER_SCALE);

  // Danh sách ảnh đầy đủ (sẽ được append khi tải trang sau)
  let allImages = [...firstImages];

  // -------- Init PageFlip ngay sau khi có 8 trang đầu --------
  const pageFlip = new PageFlip(bookElement, {
    width: baseWidth,
    height: baseHeight,
    size: "stretch",
    minWidth: 300,
    maxWidth: 1600,
    minHeight: 400,
    maxHeight: 1000,
    drawShadow: true,
    flippingTime: 500,
    usePortrait: true,
    autoSize: true,
    maxShadowOpacity: 0.6,
    showCover: true,
    mobileScrollSupport: true,
    disableFlipByClick: false,
  });

  pageFlip.loadFromImages(allImages);

  // ================== Phase 2: PRELOAD BACKGROUND ==================
  let preloadBuffer = [];
  let isUserFlipping = false;
  let updateScheduled = false;

  // Khi user đang flip thì không update
  pageFlip.on("flip", () => {
    isUserFlipping = true;

    setTimeout(() => {
      isUserFlipping = false;
      maybeUpdateFromBuffer();
    }, 300);
  });

  function maybeUpdateFromBuffer() {
    if (isUserFlipping) return;
    if (updateScheduled) return;
    if (preloadBuffer.length === 0) return;

    updateScheduled = true;

    setTimeout(() => {
      allImages = [...allImages, ...preloadBuffer];
      preloadBuffer = [];

      // Cập nhật flipbook khi ổn định (không flash)
      pageFlip.updateFromImages(allImages);

      updateScheduled = false;
    }, 220);
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

  // Bắt đầu preload background
  preloadRemainingPages();

  // ================== TOOLBAR & EDGE ==================
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

  // ================== ZOOM ==================
  let zoom = 1;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.1;

  function applyZoom() {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

    zoomContainer.style.width = `${zoom * 100}%`;
    zoomContainer.style.height = `${zoom * 100}%`;

    if (zoom > 1) wrapper.classList.add("zoomed");
    else {
      wrapper.classList.remove("zoomed");
      wrapper.scrollLeft = 0;
      wrapper.scrollTop = 0;
      zoomContainer.style.width = "100%";
      zoomContainer.style.height = "100%";
    }
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

  // ================== DRAG ==================
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

  // ================== DOUBLE CLICK EXIT ZOOM ==================
  bookElement.addEventListener("dblclick", (e) => {
    if (zoom > 1) {
      zoom = 1;
      applyZoom();
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // ================== UPDATE BUTTONS ==================
  function updateButtons() {
    const curr = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();

    btnFirst.disabled = curr === 0;
    btnPrev.disabled = curr === 0;
    btnNext.disabled = curr === total - 1;

    [btnFirst, btnPrev, btnNext].forEach((btn) => {
      btn.style.opacity = btn.disabled ? "0.4" : "1";
      btn.style.cursor = btn.disabled ? "default" : "pointer";
    });
  }

  updateButtons();
  pageFlip.on("flip", updateButtons);
}
