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
  const [activeTab, setActiveTab] = useState("rooms"); // "rooms", "billing"

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

  // Add/Edit room
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null); // null hoặc room object
  const [newCode, setNewCode] = useState("");
  const [newRent, setNewRent] = useState(3500000);
  const [newTrash, setNewTrash] = useState(30000);

  // View room details
  const [viewingRoomId, setViewingRoomId] = useState(null);

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

  function saveRoom() {
    const code = newCode.trim();
    if (!code) return alert("Nhập mã phòng (vd: 01)");
    
    if (editingRoom) {
      // Sửa phòng
      if (rooms.some(r => r.code === code && r.id !== editingRoom.id)) {
        return alert("Mã phòng bị trùng!");
      }
      const next = rooms.map(r => 
        r.id === editingRoom.id 
          ? { ...r, code, rent: toInt(newRent), trash_security: toInt(newTrash) }
          : r
      ).sort((a, b) => a.code.localeCompare(b.code));
      setRooms(next);
      alert("Đã cập nhật phòng thành công!");
    } else {
      // Thêm phòng mới
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
      alert("Đã thêm phòng thành công!");
    }
    
    // Reset form
    setNewCode("");
    setNewRent(3500000);
    setNewTrash(30000);
    setShowAddForm(false);
    setEditingRoom(null);
  }

  function startEditRoom(room) {
    setEditingRoom(room);
    setNewCode(room.code);
    setNewRent(room.rent);
    setNewTrash(room.trash_security);
    setShowAddForm(true);
  }

  function cancelEdit() {
    setEditingRoom(null);
    setNewCode("");
    setNewRent(3500000);
    setNewTrash(30000);
    setShowAddForm(false);
  }

  function deleteRoom(idToDelete) {
    const room = rooms.find(r => r.id === idToDelete);
    if (!room) return;
    
    if (!confirm(`Bạn có chắc muốn xóa phòng ${room.code}?\n\nLưu ý: Tất cả dữ liệu thanh toán của phòng này cũng sẽ bị xóa!`)) {
      return;
    }
    
    // Xóa phòng
    const nextRooms = rooms.filter(r => r.id !== idToDelete);
    setRooms(nextRooms);
    
    // Xóa tất cả readings của phòng này
    const nextReadings = readings.filter(r => r.roomId !== idToDelete);
    setReadings(nextReadings);
    
    // Nếu phòng đang chọn bị xóa, chọn phòng đầu tiên
    if (roomId === idToDelete) {
      if (nextRooms.length > 0) {
        setRoomId(nextRooms[0].id);
      } else {
        setRoomId(null);
      }
    }
    
    // Đóng chi tiết nếu đang xem phòng bị xóa
    if (viewingRoomId === idToDelete) {
      setViewingRoomId(null);
    }
    
    alert("Đã xóa phòng thành công!");
  }

  function getRoomReadings(roomId) {
    return readings
      .filter(r => r.roomId === roomId)
      .sort((a, b) => b.month.localeCompare(a.month));
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


  const viewingRoom = viewingRoomId ? rooms.find(r => r.id === viewingRoomId) : null;
  const viewingRoomReadings = viewingRoomId ? getRoomReadings(viewingRoomId) : [];

  return (
    <div className="container">
      {/* Menu Navigation */}
      <div className="menu-tabs">
        <button 
          className={`menu-tab ${activeTab === "rooms" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("rooms");
            setViewingRoomId(null);
            setShowAddForm(false);
            setEditingRoom(null);
          }}
        >
          Danh sách phòng
        </button>
        <button 
          className={`menu-tab ${activeTab === "billing" ? "active" : ""}`}
          onClick={() => setActiveTab("billing")}
        >
          Tính tiền
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Tab 1: Danh sách phòng */}
        {activeTab === "rooms" && (
          <>
            {/* Form thêm/sửa phòng */}
            {showAddForm && (
              <div className="card" style={{ marginBottom: "24px" }}>
                <div className="h1">{editingRoom ? "Sửa phòng" : "Thêm phòng mới"}</div>
                <p className="sub">{editingRoom ? "Cập nhật thông tin phòng" : "Nhập thông tin phòng để thêm vào hệ thống"}</p>

                <div style={{ marginTop: "24px" }}>
                  <label>Mã phòng *</label>
                  <input 
                    value={newCode} 
                    onChange={(e) => setNewCode(e.target.value)} 
                    placeholder="01, 02, 03..." 
                    style={{ marginTop: "8px" }}
                  />
                </div>

                <div className="row" style={{ marginTop: "20px" }}>
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

                <div style={{ marginTop: "28px", display: "flex", gap: "12px" }}>
                  <button 
                    className="btn btn-ghost" 
                    onClick={cancelEdit}
                    style={{ flex: 1 }}
                  >
                    Hủy
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={saveRoom}
                    style={{ flex: 2 }}
                  >
                    {editingRoom ? "Lưu thay đổi" : "Thêm phòng"}
                  </button>
                </div>
              </div>
            )}

            {/* Chi tiết phòng */}
            {viewingRoomId && viewingRoom && (
              <div className="card" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "20px" }}>
                  <div>
                    <div className="h1">Chi tiết phòng {viewingRoom.code}</div>
                    <p className="sub">Thông tin và lịch sử thanh toán</p>
                  </div>
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => setViewingRoomId(null)}
                    style={{ padding: "8px 16px", fontSize: "14px" }}
                  >
                    Đóng
                  </button>
                </div>

                <div className="kpi" style={{ marginBottom: "24px" }}>
                  <div className="kpiBox">
                    <div className="kpiTitle">Tiền phòng</div>
                    <div className="kpiValue">{money(viewingRoom.rent)}</div>
                  </div>
                  <div className="kpiBox">
                    <div className="kpiTitle">Rác + An ninh</div>
                    <div className="kpiValue">{money(viewingRoom.trash_security)}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 600, marginBottom: "16px", fontSize: "15px", color: "#1d1d1f", letterSpacing: "-0.01em" }}>Lịch sử thanh toán</div>
                  {viewingRoomReadings.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "#86868b", background: "rgba(245,245,247,0.8)", backdropFilter: "blur(10px)", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
                      Chưa có dữ liệu thanh toán
                    </div>
                  ) : (
                    <div className="readings-list">
                      {viewingRoomReadings.map((reading, idx) => (
                        <div key={idx} className="reading-item">
                          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                            {dayjs(reading.month + "-01").format("MM/YYYY")}
                          </div>
                          <div className="small" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div>Điện: {reading.elec_old} → {reading.elec_new}</div>
                            <div>Nước: {reading.water_old} → {reading.water_new}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Danh sách phòng */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <div className="h1">Danh sách phòng</div>
                  <p className="sub">Quản lý thông tin và tính tiền cho từng phòng</p>
                </div>
                {!showAddForm && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setShowAddForm(true);
                      setEditingRoom(null);
                      setNewCode("");
                      setNewRent(3500000);
                      setNewTrash(30000);
                    }}
                  >
                    Thêm phòng
                  </button>
                )}
              </div>

              {rooms.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", color: "#86868b" }}>
                  <div style={{ fontSize: "64px", marginBottom: "20px", opacity: 0.5 }}>🏠</div>
                  <div style={{ marginBottom: "24px", fontSize: "16px", fontWeight: 500, color: "#1d1d1f" }}>Chưa có phòng nào. Hãy thêm phòng mới!</div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      setShowAddForm(true);
                      setEditingRoom(null);
                    }}
                    style={{ maxWidth: "280px", margin: "0 auto" }}
                  >
                    Thêm phòng đầu tiên
                  </button>
                </div>
              ) : (
                <div className="rooms-grid">
                  {rooms.map(r => (
                    <div key={r.id} className="room-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                        <div>
                          <div style={{ fontWeight: 950, fontSize: "18px", marginBottom: "4px" }}>
                            Phòng {r.code}
                            {r.id === roomId && (
                              <span style={{ marginLeft: "8px", fontSize: "12px", color: "#12b76a", fontWeight: 600 }}>
                                ✓ Đang chọn
                              </span>
                            )}
                          </div>
                          <div className="muted" style={{ fontSize: "13px" }}>
                            Tiền phòng: {money(r.rent)}
                          </div>
                          <div className="muted" style={{ fontSize: "13px" }}>
                            Rác+AN: {money(r.trash_security)}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                        <button 
                          className="btn btn-ghost" 
                          onClick={() => {
                            setViewingRoomId(r.id);
                            setShowAddForm(false);
                            setEditingRoom(null);
                          }}
                          style={{ flex: 1, minWidth: "90px", fontSize: "14px", padding: "12px" }}
                        >
                          Chi tiết
                        </button>
                        <button 
                          className="btn btn-ghost" 
                          onClick={() => {
                            startEditRoom(r);
                            setViewingRoomId(null);
                          }}
                          style={{ flex: 1, minWidth: "90px", fontSize: "14px", padding: "12px" }}
                        >
                          Sửa
                        </button>
                        <button 
                          className="btn btn-ghost" 
                          onClick={() => deleteRoom(r.id)}
                          style={{ flex: 1, minWidth: "90px", fontSize: "14px", padding: "12px", color: "#ff3b30" }}
                        >
                          Xóa
                        </button>
                        <button 
                          className="btn btn-green" 
                          onClick={() => {
                            setRoomId(r.id);
                            setActiveTab("billing");
                          }}
                          style={{ flex: 1, minWidth: "110px", fontSize: "14px", padding: "12px" }}
                        >
                          Tính tiền
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
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
              <div style={{ marginTop: "24px", padding: "24px", background: "rgba(255,204,0,0.1)", backdropFilter: "blur(10px)", borderRadius: "20px", border: "0.5px solid rgba(255,204,0,0.2)" }}>
                <div style={{ fontWeight: 600, marginBottom: "8px", color: "#1d1d1f", fontSize: "16px" }}>Chưa chọn phòng</div>
                <div className="small" style={{ marginBottom: "20px", color: "#86868b" }}>Vui lòng chọn phòng từ danh sách để tính tiền</div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setActiveTab("rooms")}
                  style={{ width: "100%" }}
                >
                  Chọn phòng
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
                    style={{ marginLeft: "auto", padding: "8px 16px", fontSize: "14px", background: "rgba(255,255,255,0.2)", border: "0.5px solid rgba(255,255,255,0.3)", color: "#fff" }}
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

                <div style={{ marginTop: 20 }} className="row">
                  <div className="kpiBox">
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "16px", color: "#1d1d1f", letterSpacing: "-0.01em" }}>ĐIỆN</div>
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
                    <div style={{ marginTop: 12 }} className="small">
                      Tổng: <b style={{ color: "#1d1d1f" }}>{billPreview.elecTotal}</b> · Tiền điện: <b style={{ color: "#1d1d1f" }}>{money(billPreview.elecCost)}</b>
                    </div>
                  </div>

                  <div className="kpiBox">
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "16px", color: "#1d1d1f", letterSpacing: "-0.01em" }}>NƯỚC</div>
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
                    <div style={{ marginTop: 12 }} className="small">
                      Tổng: <b style={{ color: "#1d1d1f" }}>{billPreview.waterTotal}</b> · Tiền nước: <b style={{ color: "#1d1d1f" }}>{money(billPreview.waterCost)}</b>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20 }} className="kpi">
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <div style={{ fontSize: "17px", fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.01em" }}>Tổng cộng</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#1d1d1f", letterSpacing: "-0.02em" }}>{money(billPreview.total)}</div>
                </div>

                <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={saveReading} style={{ flex: 1, minWidth: "140px" }}>Lưu tháng này</button>
                  <button className="btn btn-green" onClick={exportPdf} style={{ flex: 1, minWidth: "140px" }}>Xuất PDF</button>
                </div>

                <div style={{ marginTop: 12 }} className="small">
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
