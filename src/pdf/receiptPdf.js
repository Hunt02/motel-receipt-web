// src/pdf/receiptPdf.js
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const A5 = { w: 420.94, h: 595.28 }; // points

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const money = (n) => toInt(n).toLocaleString("vi-VN");
const safe = (v) => (v ?? "").toString();

/**
 * Load font bytes from /public via fetch("/fonts/xxx.ttf")
 * - Nếu đường dẫn sai / font không tồn tại => throw rõ ràng.
 * - Nếu server trả HTML (404 page) => throw rõ ràng (tránh Unknown font format).
 */
async function loadFontBytes(publicPath) {
  const res = await fetch(publicPath, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(
      `Không tải được font (${res.status}) tại: ${publicPath}. ` +
        `Kiểm tra folder public/fonts và tên file.`
    );
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const buf = await res.arrayBuffer();
  const u8 = new Uint8Array(buf);

  // Nếu trả HTML (thường bắt đầu bằng "<!DO" hoặc "<html")
  const first4 = String.fromCharCode(...u8.slice(0, 4));
  const first5 = String.fromCharCode(...u8.slice(0, 5)).toLowerCase();
  if (contentType.includes("text/html") || first4 === "<!DO" || first5 === "<html") {
    throw new Error(
      `Font path ${publicPath} đang trả về HTML (thường do 404). ` +
        `Hãy đảm bảo có file .ttf thật trong public/fonts.`
    );
  }

  // Check signature: TTF thường bắt đầu 00 01 00 00, OTF là "OTTO"
  const sig =
    u8.length >= 4
      ? [u8[0], u8[1], u8[2], u8[3]].map((b) => b.toString(16).padStart(2, "0")).join(" ")
      : "";
  const isTTF = u8.length >= 4 && u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00;
  const isOTF = u8.length >= 4 && u8[0] === 0x4f && u8[1] === 0x54 && u8[2] === 0x54 && u8[3] === 0x4f; // OTTO
  const isTTC = u8.length >= 4 && u8[0] === 0x74 && u8[1] === 0x74 && u8[2] === 0x63 && u8[3] === 0x66; // ttcf

  if (!isTTF && !isOTF && !isTTC) {
    throw new Error(
      `Font không đúng định dạng TTF/OTF/TTC tại ${publicPath}. Signature bytes: ${sig}. ` +
        `Có thể bạn tải nhầm .woff/.woff2 hoặc đổi đuôi.`
    );
  }

  return buf;
}

export function computeBill(input) {
  const elecOld = toInt(input.elecOld);
  const elecNew = toInt(input.elecNew);
  const waterOld = toInt(input.waterOld);
  const waterNew = toInt(input.waterNew);

  const elecPrice = toInt(input.elecPrice);
  const waterPrice = toInt(input.waterPrice);

  const rent = toInt(input.rent);
  const trashSecurity = toInt(input.trashSecurity);

  const elecTotal = Math.max(0, elecNew - elecOld);
  const waterTotal = Math.max(0, waterNew - waterOld);

  const elecCost = elecTotal * elecPrice;
  const waterCost = waterTotal * waterPrice;

  const total = rent + trashSecurity + elecCost + waterCost;

  return {
    elecOld,
    elecNew,
    elecTotal,
    elecPrice,
    elecCost,
    waterOld,
    waterNew,
    waterTotal,
    waterPrice,
    waterCost,
    rent,
    trashSecurity,
    total,
  };
}

export async function makeReceiptPdf(payload) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // ✅ Font Unicode để in tiếng Việt
  const fontBytes = await loadFontBytes("/font/NotoSans-Regular.TTF");
  const fontBoldBytes = await loadFontBytes("/font/NotoSans-Bold.TTF");

  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const fontB = await pdfDoc.embedFont(fontBoldBytes, { subset: true });

  const page = pdfDoc.addPage([A5.w, A5.h]);

  // ✅ Tự tính
  const bill = computeBill(payload);

  const margin = 32;
  let y = A5.h - 52;

  const center = (txt, f, size) => {
    txt = safe(txt);
    const w = f.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: (A5.w - w) / 2, y, size, font: f });
    y -= size + 6;
  };

  const draw = (txt, x, yy, size = 10, f = font) => {
    page.drawText(safe(txt), { x, y: yy, size, font: f });
  };

  const drawRight = (txt, rightX, yy, size = 10, f = font) => {
    txt = safe(txt);
    const w = f.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: rightX - w, y: yy, size, font: f });
  };

  // Header
  center("GIẤY BÁO THU TIỀN", fontB, 18);
  center(payload.monthText || "", font, 10);
  y -= 4;
  center(payload.roomText || "", fontB, 12);
  y -= 14;

  // Two columns (Điện/Nước)
  const leftX = margin;
  const rightColX = A5.w / 2 + 10;

  const lv = (x, yy, label, value) => {
    draw(label, x, yy, 10, font);
    draw(`:  ${value}`, x + 100, yy, 10, font);
  };

  draw("ĐIỆN:", leftX, y, 11, fontB);
  draw("NƯỚC:", rightColX, y, 11, fontB);
  y -= 18;

  lv(leftX, y, "Số điện mới", bill.elecNew);
  lv(rightColX, y, "Số nước mới", bill.waterNew);
  y -= 16;

  lv(leftX, y, "Số điện cũ", bill.elecOld);
  lv(rightColX, y, "Số nước cũ", bill.waterOld);
  y -= 16;

  lv(leftX, y, "Tổng", bill.elecTotal);
  lv(rightColX, y, "Tổng", bill.waterTotal);
  y -= 26;

  // Payment section
  draw("CHI PHÍ THANH TOÁN", margin, y, 11, fontB);
  y -= 18;

  const item = (label, value, bold = false) => {
    const f = bold ? fontB : font;
    const size = bold ? 11 : 10;
    draw(`› ${label}`, margin + 10, y, size, f);
    drawRight(money(value), A5.w - margin, y, size, f);
    y -= 16;
  };

  item("Tiền phòng", bill.rent);
  item(`Tiền điện  (${bill.elecTotal} x ${money(bill.elecPrice)})`, bill.elecCost);
  item(`Tiền nước  (${bill.waterTotal} x ${money(bill.waterPrice)})`, bill.waterCost);
  item("Tiền rác + an ninh", bill.trashSecurity);

  y -= 6;
  item("Tổng cộng", bill.total, true);

  // Thông tin tài khoản ngân hàng (ở giữa, in đậm)
  y -= 24;
  center("THÔNG TIN CHUYỂN KHOẢN", fontB, 12);
  y -= 16;
  center("Số tài khoản: 19010600751014", fontB, 10);
  y -= 14;
  center("Tên tài khoản: NGUYEN THI MINH SON", fontB, 10);
  y -= 14;
  center("Ngân hàng: TECHCOMBANK", fontB, 10);

  // Footer (đơn giá)
  y -= 20;
  draw(`Giá điện: ${money(bill.elecPrice)} / 1 kWh`, margin, y, 9, font);
  y -= 14;
  draw(`Giá nước: ${money(bill.waterPrice)} / 1 số`, margin, y, 9, font);

  return await pdfDoc.save();
}
