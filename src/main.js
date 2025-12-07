// src/main.js
import "./styles/base.css";
import "./styles/toolbar.css";
import "./styles/flipbook.css";
import { initFlipbookApp } from "./flipbookApp";

// Tính URL PDF từ BASE_URL (dev & build đều chạy được)
const pdfUrl = new URL(
  `${import.meta.env.BASE_URL}magazine.pdf`,
  window.location.origin
).href;

initFlipbookApp(pdfUrl).catch((err) => {
  console.error("Lỗi khởi tạo flipbook:", err);
});
