import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { computeBill, makeReceiptPdf } from "./pdf/receiptPdf.js";

const LS_ROOMS = "motel_rooms_v1";
const LS_READINGS = "motel_readings_v1";

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const money = (n) => toInt(n).toLocaleString("vi-VN");

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function downloadBytesAsPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // ✅ tránh revoke quá sớm khiến file không tải ở vài máy
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function App() {
  // Rooms
  const [rooms, setRooms] = useState(() => {
    const r = loadJson(LS_ROOMS, null);
    if (Array.isArray(r) && r.length) return r;
    return [{ id: crypto.randomUUID(), code: "01", rent: 3500000, trash_security: 30000 }];
  });

  const [roomId, setRoomId] = useState(() => {
    const r = loadJson(LS_ROOMS, null);
    if (Array.isArray(r) && r.length) return r[0].id;
    return null;
  });

  // Readings
  const [readings, setReadings] = useState(() => loadJson(LS_READINGS, []));

  // Add room
  const [newCode, setNewCode] = useState("");
  const [newRent, setNewRent] = useState(3500000);
  const [newTrash, setNewTrash] = useState(30000);

  // Billing inputs
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [elecOld, setElecOld] = useState(0);
  const [elecNew, setElecNew] = useState("");
  const [waterOld, setWaterOld] = useState(0);
  const [waterNew, setWaterNew] = useState("");

  const [elecPrice, setElecPrice] = useState(3500);
  const [waterPrice, setWaterPrice] = useState(14000);

  const room = useMemo(() => rooms.find(r => r.id === roomId) || null, [rooms, roomId]);

  useEffect(() => saveJson(LS_ROOMS, rooms), [rooms]);
  useEffect(() => saveJson(LS_READINGS, readings), [readings]);

  useEffect(() => {
    if (!roomId && rooms.length) setRoomId(rooms[0].id);
  }, [roomId, rooms]);

  const getByMonth = (rid, m) => readings.find(x => x.roomId === rid && x.month === m) || null;

  // Tìm tháng gần nhất trước tháng hiện tại để lấy số mới làm số cũ
  const getLastBeforeMonth = (rid, currentMonth) => {
    const arr = readings
      .filter(x => x.roomId === rid && x.month < currentMonth)
      .sort((a, b) => (a.month > b.month ? -1 : 1));
    return arr.length > 0 ? arr[0] : null;
  };

  useEffect(() => {
    if (!roomId) return;

    // Nếu đã có dữ liệu của tháng này, load lại
    const exist = getByMonth(roomId, month);
    if (exist) {
      setElecOld(exist.elec_old);
      setElecNew(exist.elec_new);
      setWaterOld(exist.water_old);
      setWaterNew(exist.water_new);
      setElecPrice(exist.elec_price);
      setWaterPrice(exist.water_price);
      return;
    }

    // Nếu chưa có dữ liệu tháng này, tự động lấy số mới của tháng trước làm số cũ
    const lastMonth = getLastBeforeMonth(roomId, month);
    if (lastMonth) {
      setElecOld(lastMonth.elec_new); // Số mới của tháng trước = số cũ của tháng này
      setWaterOld(lastMonth.water_new);
      setElecPrice(lastMonth.elec_price); // Giữ giá của tháng trước
      setWaterPrice(lastMonth.water_price);
    } else {
      setElecOld(0);
      setWaterOld(0);
    }
    setElecNew("");
    setWaterNew("");
  }, [roomId, month, readings]);

  const billPreview = useMemo(() => {
    return computeBill({
      elecOld, elecNew,
      waterOld, waterNew,
      elecPrice, waterPrice,
      rent: room?.rent ?? 0,
      trashSecurity: room?.trash_security ?? 0,
    });
  }, [elecOld, elecNew, waterOld, waterNew, elecPrice, waterPrice, room]);

  function addRoom() {
    const code = newCode.trim();
    if (!code) return alert("Nhập mã phòng (vd: 01)");
    if (rooms.some(r => r.code === code)) return alert("Mã phòng bị trùng!");

    const obj = {
      id: crypto.randomUUID(),
      code,
      rent: toInt(newRent),
      trash_security: toInt(newTrash),
    };
    const next = [...rooms, obj].sort((a, b) => a.code.localeCompare(b.code));
    setRooms(next);
    setRoomId(obj.id);
    setNewCode("");
  }

  function saveReading() {
    if (!room) return alert("Chưa chọn phòng!");
    if (elecNew === "" || waterNew === "") return alert("Nhập số điện mới & số nước mới");
    if (toInt(elecNew) < toInt(elecOld)) return alert("Số điện mới < số điện cũ");
    if (toInt(waterNew) < toInt(waterOld)) return alert("Số nước mới < số nước cũ");

    const rec = {
      roomId: room.id,
      month,
      elec_old: toInt(elecOld),
      elec_new: toInt(elecNew),
      water_old: toInt(waterOld),
      water_new: toInt(waterNew),
      elec_price: toInt(elecPrice),
      water_price: toInt(waterPrice),
    };

    const idx = readings.findIndex(x => x.roomId === room.id && x.month === month);
    const next = idx >= 0 ? readings.map((x, i) => (i === idx ? rec : x)) : [...readings, rec];

    setReadings(next);
    alert("Đã lưu dữ liệu tháng này! Số mới sẽ tự động thành số cũ cho tháng sau.");
  }

  async function exportPdf() {
  try {
    if (!room) return alert("Chưa chọn phòng!");
    if (elecNew === "" || waterNew === "") return alert("Nhập số điện mới & số nước mới trước khi xuất PDF");
    if (toInt(elecNew) < toInt(elecOld)) return alert("Số điện mới < số điện cũ");
    if (toInt(waterNew) < toInt(waterOld)) return alert("Số nước mới < số nước cũ");

    const monthText = `Tháng ${month.split("-")[1]} năm ${month.split("-")[0]}`;
    const roomText = `Phòng: ${room.code}`;

    const bytes = await makeReceiptPdf({
      monthText,
      roomText,
      elecOld,
      elecNew,
      waterOld,
      waterNew,
      elecPrice,
      waterPrice,
      rent: room.rent,
      trashSecurity: room.trash_security,
    });

    downloadBytesAsPdf(bytes, `GiayBaoThuTien_Phong${room.code}_${month}.pdf`);

    // ✅ Lưu vào database (localStorage) - số mới của tháng này sẽ tự động thành số cũ của tháng sau
    const rec = {
      roomId: room.id,
      month,
      elec_old: toInt(elecOld),
      elec_new: toInt(elecNew),
      water_old: toInt(waterOld),
      water_new: toInt(waterNew),
      elec_price: toInt(elecPrice),
      water_price: toInt(waterPrice),
    };
    const idx = readings.findIndex((x) => x.roomId === room.id && x.month === month);
    const nextReadings = idx >= 0 ? readings.map((x, i) => (i === idx ? rec : x)) : [...readings, rec];
    setReadings(nextReadings);
    
    alert("Đã xuất PDF và lưu dữ liệu! Số mới sẽ tự động thành số cũ cho tháng sau.");
  } catch (e) {
    console.error(e);
    alert("Xuất PDF lỗi: " + (e?.message || e));
  }
}


  return (
    <div className="container">
      <div className="grid">
        {/* LEFT */}
        <div className="card">
          <div className="h1">Phòng trọ</div>
          <p className="sub">Chọn phòng để nhập chỉ số theo tháng (dữ liệu lưu LocalStorage)</p>

          <div className="list">
            {rooms.map(r => (
              <div
                key={r.id}
                className={"item " + (r.id === roomId ? "active" : "")}
                onClick={() => setRoomId(r.id)}
              >
                <div style={{ fontWeight: 950 }}>Phòng {r.code}</div>
                <div className="muted">
                  Tiền phòng: {money(r.rent)} · Rác+AN: {money(r.trash_security)}
                </div>
              </div>
            ))}
          </div>

          <hr className="sep" />

          <div className="h1" style={{ fontSize: 16 }}>Thêm phòng</div>
          <div className="row">
            <div>
              <label>Mã phòng</label>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="01" />
            </div>
            <div>
              <label>Tiền phòng</label>
              <input type="number" value={newRent} onChange={(e) => setNewRent(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Rác + An ninh</label>
            <input type="number" value={newTrash} onChange={(e) => setNewTrash(e.target.value)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={addRoom} style={{ width: "100%" }}>
              Thêm phòng
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
            <div>
              <div className="h1">Lập phiếu thu</div>
              <p className="sub">Nhập số mới → tự tính → xuất PDF A5 (không QR)</p>
            </div>
            <button className="btn btn-green" onClick={exportPdf}>Xuất PDF</button>
          </div>

          <div className="row3">
            <div>
              <label>Tháng</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <label>Giá điện (VND/kWh)</label>
              <input type="number" value={elecPrice} onChange={(e) => setElecPrice(e.target.value)} />
            </div>
            <div>
              <label>Giá nước (VND/số)</label>
              <input type="number" value={waterPrice} onChange={(e) => setWaterPrice(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="row">
            <div className="kpiBox">
              <div style={{ fontWeight: 950, marginBottom: 8 }}>ĐIỆN</div>
              <div className="row">
                <div>
                  <label>Số cũ</label>
                  <input type="number" value={elecOld} onChange={(e) => setElecOld(e.target.value)} />
                </div>
                <div>
                  <label>Số mới</label>
                  <input type="number" value={elecNew} onChange={(e) => setElecNew(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 10 }} className="small">
                Tổng: <b>{billPreview.elecTotal}</b> · Tiền điện: <b>{money(billPreview.elecCost)}</b>
              </div>
            </div>

            <div className="kpiBox">
              <div style={{ fontWeight: 950, marginBottom: 8 }}>NƯỚC</div>
              <div className="row">
                <div>
                  <label>Số cũ</label>
                  <input type="number" value={waterOld} onChange={(e) => setWaterOld(e.target.value)} />
                </div>
                <div>
                  <label>Số mới</label>
                  <input type="number" value={waterNew} onChange={(e) => setWaterNew(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 10 }} className="small">
                Tổng: <b>{billPreview.waterTotal}</b> · Tiền nước: <b>{money(billPreview.waterCost)}</b>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="kpi">
            <div className="kpiBox">
              <div className="kpiTitle">Tiền phòng</div>
              <div className="kpiValue">{money(billPreview.rent)}</div>
            </div>
            <div className="kpiBox">
              <div className="kpiTitle">Rác + An ninh</div>
              <div className="kpiValue">{money(billPreview.trashSecurity)}</div>
            </div>
          </div>

          <hr className="sep" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="small">Tổng cộng</div>
            <div style={{ fontSize: 26, fontWeight: 950 }}>{money(billPreview.total)}</div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={saveReading}>Lưu tháng này</button>
          </div>

          <div style={{ marginTop: 8 }} className="small">
            * Khi xuất PDF, hệ thống vẫn tự tính lại toàn bộ dựa trên số bạn nhập.
          </div>
        </div>
      </div>
    </div>
  );
}
