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
  // Tab navigation
  const [activeTab, setActiveTab] = useState("rooms"); // "rooms", "add", "billing"

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
    setNewRent(3500000);
    setNewTrash(30000);
    alert("Đã thêm phòng thành công!");
    setActiveTab("rooms"); // Chuyển về tab danh sách
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
      {/* Menu Navigation */}
      <div className="menu-tabs">
        <button 
          className={`menu-tab ${activeTab === "rooms" ? "active" : ""}`}
          onClick={() => setActiveTab("rooms")}
        >
          📋 Danh sách phòng
        </button>
        <button 
          className={`menu-tab ${activeTab === "add" ? "active" : ""}`}
          onClick={() => setActiveTab("add")}
        >
          ➕ Thêm phòng
        </button>
        <button 
          className={`menu-tab ${activeTab === "billing" ? "active" : ""}`}
          onClick={() => setActiveTab("billing")}
        >
          💰 Tính tiền
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Tab 1: Danh sách phòng */}
        {activeTab === "rooms" && (
          <div className="card">
            <div className="h1">Danh sách phòng</div>
            <p className="sub">Chọn phòng để xem thông tin hoặc tính tiền</p>

            {rooms.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#667085" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏠</div>
                <div>Chưa có phòng nào. Hãy thêm phòng mới!</div>
              </div>
            ) : (
              <div className="list">
                {rooms.map(r => (
                  <div
                    key={r.id}
                    className={"item " + (r.id === roomId ? "active" : "")}
                    onClick={() => {
                      setRoomId(r.id);
                      setActiveTab("billing");
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: "16px" }}>Phòng {r.code}</div>
                    <div className="muted" style={{ marginTop: "4px" }}>
                      Tiền phòng: {money(r.rent)} · Rác+AN: {money(r.trash_security)}
                    </div>
                    {r.id === roomId && (
                      <div style={{ marginTop: "8px", fontSize: "12px", color: "#12b76a", fontWeight: 600 }}>
                        ✓ Đang chọn
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setActiveTab("add")}
                style={{ flex: 1 }}
              >
                ➕ Thêm phòng mới
              </button>
              {roomId && (
                <button 
                  className="btn btn-green" 
                  onClick={() => setActiveTab("billing")}
                  style={{ flex: 1 }}
                >
                  💰 Tính tiền
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Thêm phòng */}
        {activeTab === "add" && (
          <div className="card">
            <div className="h1">Thêm phòng mới</div>
            <p className="sub">Nhập thông tin phòng để thêm vào hệ thống</p>

            <div style={{ marginTop: "20px" }}>
              <label>Mã phòng *</label>
              <input 
                value={newCode} 
                onChange={(e) => setNewCode(e.target.value)} 
                placeholder="01, 02, 03..." 
                style={{ marginTop: "6px" }}
              />
            </div>

            <div className="row" style={{ marginTop: "16px" }}>
              <div>
                <label>Tiền phòng (VND) *</label>
                <input 
                  type="number" 
                  value={newRent} 
                  onChange={(e) => setNewRent(e.target.value)} 
                  style={{ marginTop: "6px" }}
                />
              </div>
              <div>
                <label>Rác + An ninh (VND) *</label>
                <input 
                  type="number" 
                  value={newTrash} 
                  onChange={(e) => setNewTrash(e.target.value)} 
                  style={{ marginTop: "6px" }}
                />
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", gap: "10px" }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setNewCode("");
                  setNewRent(3500000);
                  setNewTrash(30000);
                  setActiveTab("rooms");
                }}
                style={{ flex: 1 }}
              >
                Hủy
              </button>
              <button 
                className="btn btn-primary" 
                onClick={addRoom}
                style={{ flex: 2 }}
              >
                ➕ Thêm phòng
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Tính tiền */}
        {activeTab === "billing" && (
          <div className="card">
            <div>
              <div className="h1">Lập phiếu thu</div>
              <p className="sub">Nhập số mới → tự tính → xuất PDF A5</p>
            </div>

            {/* Chọn phòng nếu chưa có */}
            {!room ? (
              <div style={{ marginTop: "20px", padding: "20px", background: "#fef3c7", borderRadius: "12px", border: "1px solid #fde68a" }}>
                <div style={{ fontWeight: 600, marginBottom: "8px" }}>⚠️ Chưa chọn phòng</div>
                <div className="small" style={{ marginBottom: "16px" }}>Vui lòng chọn phòng từ danh sách để tính tiền</div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setActiveTab("rooms")}
                  style={{ width: "100%" }}
                >
                  📋 Chọn phòng
                </button>
              </div>
            ) : (
              <>
                {/* Hiển thị phòng đang chọn */}
                <div className="room-badge">
                  <div className="room-badge-icon">🏠</div>
                  <div>
                    <div className="room-badge-title">Đang tính tiền cho</div>
                    <div className="room-badge-name">Phòng {room.code}</div>
                  </div>
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => setActiveTab("rooms")}
                    style={{ marginLeft: "auto", padding: "6px 12px", fontSize: "12px" }}
                  >
                    Đổi phòng
                  </button>
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

                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={saveReading} style={{ flex: 1, minWidth: "120px" }}>Lưu tháng này</button>
                  <button className="btn btn-green" onClick={exportPdf} style={{ flex: 1, minWidth: "120px" }}>Xuất PDF</button>
                </div>

                <div style={{ marginTop: 8 }} className="small">
                  * Khi xuất PDF, hệ thống vẫn tự tính lại toàn bộ dựa trên số bạn nhập.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
