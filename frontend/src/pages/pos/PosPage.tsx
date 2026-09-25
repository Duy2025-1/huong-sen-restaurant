import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  ArrowRightLeft, 
  Receipt, 
  CreditCard, 
  QrCode, 
  Banknote, 
  X, 
  Clock, 
  Utensils, 
  BellRing,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

export const PosPage: React.FC = () => {
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | 'all'>('all');
  const [selectedTable, setSelectedTable] = useState<any | null>(null);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState(false);
  const [targetMoveTableId, setTargetMoveTableId] = useState<number | ''>('');

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vnpay' | 'card'>('cash');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Quick Open session state
  const [guestCountInput, setGuestCountInput] = useState(2);

  // Bill request notification alert
  const [billAlert, setBillAlert] = useState<string | null>(null);

  const loadTables = async () => {
    try {
      const res = await api.get('/tables');
      setAreas(res.data);
    } catch (err) {
      console.error('Error loading tables:', err);
    }
  };

  useEffect(() => {
    loadTables();

    function handleTableStatusChanged() { loadTables(); }
    function handleBillRequested(data: any) {
      setBillAlert(`🔔 BÀN ${data.tableNumber} YÊU CẦU TÍNH TIỀN! (${data.totalAmount.toLocaleString('vi-VN')} đ)`);
      loadTables();
    }
    function handlePaymentCompleted() { loadTables(); }

    socket.on('table_status_changed', handleTableStatusChanged);
    socket.on('bill_requested', handleBillRequested);
    socket.on('payment_completed', handlePaymentCompleted);
    socket.on('order_items_added', handleTableStatusChanged);

    return () => {
      socket.off('table_status_changed', handleTableStatusChanged);
      socket.off('bill_requested', handleBillRequested);
      socket.off('payment_completed', handlePaymentCompleted);
      socket.off('order_items_added', handleTableStatusChanged);
    };
  }, []);

  const allTables = areas.flatMap((a) => a.tables);
  const displayedTables =
    selectedAreaId === 'all'
      ? allTables
      : areas.find((a) => a.id === selectedAreaId)?.tables || [];

  const handleOpenSession = async (tableId: number) => {
    try {
      await api.post(`/tables/${tableId}/open-session`, {
        guestCount: guestCountInput,
      });
      loadTables();
      setSelectedTable(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi mở bàn.');
    }
  };

  const handleMoveTable = async () => {
    if (!selectedTable || !targetMoveTableId) return;
    try {
      await api.post('/tables/change-table', {
        fromTableId: selectedTable.id,
        toTableId: targetMoveTableId,
      });
      alert('Đã chuyển bàn thành công!');
      setIsMoveTableModalOpen(false);
      setSelectedTable(null);
      loadTables();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi chuyển bàn.');
    }
  };

  const handleFinishCleaning = async (tableId: number) => {
    try {
      await api.patch(`/tables/${tableId}/status`, { status: 'available' });
      loadTables();
      setSelectedTable(null);
    } catch (err) {
      alert('Lỗi cập nhật trạng thái.');
    }
  };

  const handleSettlePayment = async () => {
    const currentOrder = selectedTable?.sessions?.[0]?.orders?.[0];
    if (!currentOrder) return;

    try {
      await api.post('/payments/settle', {
        orderId: currentOrder.id,
        method: paymentMethod,
        discountAmount,
      });

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });

      alert('✅ Thanh toán thành công! Bàn đã chuyển sang trạng thái chờ dọn dẹp.');
      setIsPaymentModalOpen(false);
      setSelectedTable(null);
      loadTables();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi thanh toán.');
    }
  };

  const statusThemes: Record<string, { bg: string; badge: string; label: string }> = {
    available: {
      bg: 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/70 hover:bg-emerald-950/30 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
      label: 'Bàn Trống',
    },
    occupied: {
      bg: 'bg-rose-950/30 border-rose-500/50 hover:border-rose-400 hover:bg-rose-950/40 text-rose-200 shadow-glow-orange',
      badge: 'bg-gradient-to-r from-rose-500 to-orange-600 text-white font-black animate-pulse',
      label: 'Đang Có Khách',
    },
    reserved: {
      bg: 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/70 text-amber-300',
      badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      label: 'Đã Giữ Chỗ',
    },
    cleaning: {
      bg: 'bg-dark-850/80 border-white/10 hover:border-white/20 text-slate-400',
      badge: 'bg-white/10 text-slate-300',
      label: 'Chờ Dọn Dẹp',
    },
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Bill notification banner */}
      {billAlert && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm shadow-glow-amber flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-5 h-5" />
            <span>{billAlert}</span>
          </div>
          <button
            onClick={() => setBillAlert(null)}
            className="px-3.5 py-1.5 rounded-xl bg-dark-950 text-amber-400 text-xs font-bold shadow hover:bg-dark-900"
          >
            Đã Tiếp Nhận
          </button>
        </div>
      )}

      {/* POS Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div>
          <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] block mb-1">
            Vận Hành Nội Bộ (In-House POS)
          </span>
          <h1 className="font-serif text-2xl sm:text-4xl font-black text-white">
            Sơ Đồ Bàn & Thu Ngân 4.0
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý trực quan phòng bàn, gọi thêm món đợt 2-3, chuyển bàn và thanh toán hóa đơn
          </p>
        </div>

        {/* Legend & Dashboard Link */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-white/15 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors font-bold mr-2 shadow-sm"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-amber-400" />
            <span>Về Dashboard</span>
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 text-emerald-400 font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Trống ({allTables.filter(t => t.status === 'available').length})
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-950/40 text-rose-300 font-bold border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Có Khách ({allTables.filter(t => t.status === 'occupied').length})
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-950/40 text-amber-300 font-bold border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Đã Đặt ({allTables.filter(t => t.status === 'reserved').length})
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-850 text-slate-400 font-bold border border-white/10">
            <span className="w-2 h-2 rounded-full bg-slate-500" /> Chờ Dọn ({allTables.filter(t => t.status === 'cleaning').length})
          </span>
        </div>
      </div>

      {/* Area Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
        <button
          onClick={() => setSelectedAreaId('all')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
            selectedAreaId === 'all'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-600/30'
              : 'bg-dark-900 text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          Toàn Bộ Chi Nhánh ({allTables.length})
        </button>

        {areas.map((area) => (
          <button
            key={area.id}
            onClick={() => setSelectedAreaId(area.id)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
              selectedAreaId === area.id
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-dark-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {area.name} ({area.tables.length})
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {displayedTables.map((table) => {
          const theme = statusThemes[table.status] || statusThemes.available;
          const currentSession = table.sessions?.[0];
          const activeOrder = currentSession?.orders?.[0];

          return (
            <div
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`p-5 rounded-3xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[160px] glass-card ${theme.bg}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-xl font-black text-white">{table.tableNumber}</h3>
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3 text-amber-400" /> {table.capacity} chỗ ngồi
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${theme.badge}`}>
                  {theme.label}
                </span>
              </div>

              {/* Order Info snippet if occupied */}
              {table.status === 'occupied' && activeOrder ? (
                <div className="mt-4 pt-3 border-t border-rose-500/20">
                  <div className="flex items-center justify-between text-xs font-black text-amber-400">
                    <span>{activeOrder.totalAmount.toLocaleString('vi-VN')} đ</span>
                    <span className="text-[10px] bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-md font-bold">
                      {activeOrder.orderItems?.length || 0} món
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-white/5 font-medium">
                  {table.status === 'cleaning' ? 'Chạm để dọn xong' : 'Chạm để mở bàn'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: Table Action Drawer */}
      {selectedTable && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-serif flex items-center justify-center font-black text-xl">
                  {selectedTable.tableNumber}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white">Chi Tiết Bàn {selectedTable.tableNumber}</h3>
                  <p className="text-xs text-slate-400">Trạng thái: <strong className="text-amber-400 uppercase">{selectedTable.status}</strong></p>
                </div>
              </div>
              <button onClick={() => setSelectedTable(null)} className="p-2 rounded-xl text-slate-400 hover:text-white bg-dark-850">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ACTION 1: TABLE IS AVAILABLE -> OPEN SESSION */}
            {selectedTable.status === 'available' && (
              <div className="py-6 space-y-5">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bàn đang trống. Mở bàn để bắt đầu phục vụ hoặc nhận order từ khách tại bàn.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-2">Số lượng khách vào bàn:</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedTable.capacity * 2}
                    value={guestCountInput}
                    onChange={(e) => setGuestCountInput(parseInt(e.target.value) || 1)}
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={() => handleOpenSession(selectedTable.id)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition"
                >
                  Xác Nhận Mở Bàn Đón Khách
                </button>
              </div>
            )}

            {/* ACTION 2: TABLE IS CLEANING -> FINISH CLEANING */}
            {selectedTable.status === 'cleaning' && (
              <div className="py-8 space-y-5 text-center">
                <p className="text-xs text-slate-400">Khách đã thanh toán và rời đi. Nhân viên đã dọn dẹp và set up lại bàn xong?</p>
                <button
                  onClick={() => handleFinishCleaning(selectedTable.id)}
                  className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm shadow-md transition"
                >
                  Hoàn Tất Dọn Bàn (Chuyển Sang Trống)
                </button>
              </div>
            )}

            {/* ACTION 3: TABLE IS OCCUPIED -> MANAGE ORDER / BILL / MOVE */}
            {selectedTable.status === 'occupied' && (
              <div className="py-5 space-y-5">
                {/* Active items list */}
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedTable.sessions?.[0]?.orders?.[0]?.orderItems?.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-2xl bg-dark-850 border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-white">{item.dish.name}</span>
                          <span className="text-amber-400 font-semibold">x{item.quantity}</span>
                        </div>
                        {item.modifiers?.length > 0 && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">+ {item.modifiers.map((m: any) => m.nameAtTime).join(', ')}</span>
                        )}
                        <span className="text-[10px] text-orange-400 font-bold uppercase mt-0.5 block">{item.status}</span>
                      </div>
                      <span className="font-bold text-slate-200">{item.totalPrice.toLocaleString('vi-VN')} đ</span>
                    </div>
                  )) || <p className="text-xs text-slate-500 text-center py-4">Chưa có món nào được gọi.</p>}
                </div>

                {/* Total */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between font-black text-sm">
                  <span className="text-slate-300">Tổng tiền thanh toán:</span>
                  <span className="text-lg text-amber-400">
                    {selectedTable.sessions?.[0]?.orders?.[0]?.totalAmount.toLocaleString('vi-VN') || 0} đ
                  </span>
                </div>

                {/* POS Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={`/table/${selectedTable.qrToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-dark-850 hover:bg-dark-800 text-slate-200 text-xs font-bold border border-white/10 transition"
                  >
                    <Utensils className="w-4 h-4 text-orange-400" />
                    <span>Thêm Món Đợt Mới</span>
                  </a>

                  <button
                    onClick={() => setIsMoveTableModalOpen(true)}
                    className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-dark-850 hover:bg-dark-800 text-slate-200 text-xs font-bold border border-white/10 transition"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                    <span>Chuyển Bàn</span>
                  </button>

                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm font-black shadow-xl shadow-orange-600/30 transition hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Receipt className="w-5 h-5" />
                    <span>Thanh Toán & In Hóa Đơn</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PAYMENT CHECKOUT */}
      {isPaymentModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-dark-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif font-black text-lg text-white">
                Thanh Toán Hóa Đơn - {selectedTable.tableNumber}
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div className="p-4 rounded-2xl bg-dark-850 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tiền món ăn:</span>
                  <span className="font-bold text-white">
                    {selectedTable.sessions?.[0]?.orders?.[0]?.subtotalAmount.toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Giảm giá / Voucher:</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-28 text-right bg-dark-900 border border-white/10 rounded-lg p-1 font-bold text-amber-400 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between text-base font-black text-amber-400">
                  <span>Khách cần trả:</span>
                  <span>
                    {Math.max(
                      0,
                      (selectedTable.sessions?.[0]?.orders?.[0]?.subtotalAmount || 0) - discountAmount
                    ).toLocaleString('vi-VN')}{' '}
                    đ
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Phương thức thanh toán:</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center p-3 rounded-2xl border transition ${
                      paymentMethod === 'cash' 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-glow-amber' 
                        : 'bg-dark-850 border-white/10 text-slate-400'
                    }`}
                  >
                    <Banknote className="w-5 h-5 mb-1 text-emerald-400" />
                    <span>Tiền Mặt</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('vnpay')}
                    className={`flex flex-col items-center p-3 rounded-2xl border transition ${
                      paymentMethod === 'vnpay' 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-glow-amber' 
                        : 'bg-dark-850 border-white/10 text-slate-400'
                    }`}
                  >
                    <QrCode className="w-5 h-5 mb-1 text-blue-400" />
                    <span>VietQR / MoMo</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center p-3 rounded-2xl border transition ${
                      paymentMethod === 'card' 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold shadow-glow-amber' 
                        : 'bg-dark-850 border-white/10 text-slate-400'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mb-1 text-purple-400" />
                    <span>Quẹt Thẻ POS</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'vnpay' && (
                <div className="p-4 rounded-2xl bg-dark-850 border border-white/10 text-center">
                  <p className="text-[11px] font-bold text-blue-400 mb-2">Quét mã VietQR thanh toán tự động:</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=RMS_PAYMENT_${selectedTable.tableNumber}_${selectedTable.sessions?.[0]?.orders?.[0]?.totalAmount}`}
                    alt="VietQR"
                    className="w-36 h-36 mx-auto rounded-xl bg-white p-1 shadow-lg"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Nội dung CK: RMS {selectedTable.tableNumber}</p>
                </div>
              )}

              <button
                onClick={handleSettlePayment}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-orange-600/30 transition hover:scale-[1.01]"
              >
                Xác Nhận Đã Thu Tiền & In Hóa Đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOVE TABLE */}
      {isMoveTableModalOpen && selectedTable && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-slate-100">
            <h3 className="font-serif font-bold text-base text-white mb-2">
              Chuyển Bàn {selectedTable.tableNumber} sang bàn khác
            </h3>
            <p className="text-xs text-slate-400 mb-4">Vui lòng chọn một bàn đang trống để chuyển toàn bộ order sang:</p>

            <select
              value={targetMoveTableId}
              onChange={(e) => setTargetMoveTableId(parseInt(e.target.value) || '')}
              className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-xs font-bold text-white mb-4 focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Chọn bàn đích còn trống --</option>
              {allTables
                .filter((t) => t.status === 'available')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tableNumber} ({t.capacity} chỗ)
                  </option>
                ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setIsMoveTableModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-dark-850 text-slate-300 font-bold text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleMoveTable}
                disabled={!targetMoveTableId}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs disabled:opacity-50"
              >
                Xác Nhận Chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
