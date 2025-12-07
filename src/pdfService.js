// src/pdfService.js
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Load PDF một lần, trả về đối tượng pdf (giữ lại để render nhiều lần)
 * @param {string} pdfUrl
 * @returns {Promise<import("pdfjs-dist").PDFDocumentProxy>}
 */
export async function loadPdf(pdfUrl) {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  return pdf;
}

/**
 * Render một đoạn trang [startPage, endPage] thành mảng ảnh (dataURL PNG)
 * @param {import("pdfjs-dist").PDFDocumentProxy} pdf
 * @param {number} startPage - trang bắt đầu (1-based)
 * @param {number} endPage   - trang kết thúc (1-based, bao gồm)
 * @param {number} scale
 * @returns {Promise<{images: string[], baseWidth: number, baseHeight: number}>}
 */
export async function renderPdfPages(pdf, startPage, endPage, scale = 1.0) {
  const images = [];
  let baseWidth = 600;
  let baseHeight = 800;

  // Đảm bảo không vượt quá số trang thật
  const safeStart = Math.max(1, startPage);
  const safeEnd = Math.min(pdf.numPages, endPage);

  for (let pageNum = safeStart; pageNum <= safeEnd; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    if (pageNum === safeStart) {
      baseWidth = viewport.width;
      baseHeight = viewport.height;
    }

    images.push(canvas.toDataURL("image/png"));
  }

  return { images, baseWidth, baseHeight };
}
