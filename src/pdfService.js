// src/pdfService.js
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Render toàn bộ PDF thành mảng ảnh (dataURL PNG)
 * @param {string} pdfUrl
 * @param {number} scale
 * @returns {Promise<{images: string[], baseWidth: number, baseHeight: number}>}
 */
export async function renderPdfToImages(pdfUrl, scale = 1.3) {
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

    await page.render({ canvasContext: context, viewport }).promise;

    if (pageNum === 1) {
      baseWidth = viewport.width;
      baseHeight = viewport.height;
    }

    images.push(canvas.toDataURL("image/png"));
  }

  return { images, baseWidth, baseHeight };
}
