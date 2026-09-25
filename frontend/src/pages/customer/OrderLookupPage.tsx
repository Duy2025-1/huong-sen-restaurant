import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Clock, CheckCircle2, AlertCircle, ShoppingBag, Truck, Calendar, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

export const OrderLookupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [orders, setOrders] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchStr?: string) => {
    const q = (searchStr !== undefined ? searchStr : query).trim();
    if (!q) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.get(`/orders/lookup/${encodeURIComponent(q)}`);
      setOrders(res.data);
    } catch (err) {
      console.error(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const statusMap: Record<string, { label: string; badge: string; step: number }> = {
    pending: { label: 'Chờ Quán Tiếp Nhận', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', step: 1 },
    preparing: { label: 'Bếp Đang Nấu Món', badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30', step: 2 },
    ready: { label: 'Đang Giao Hàng', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', step: 3 },
    completed: { label: 'Đơn Đã Hoàn Tất', badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', step: 4 },
    cancelled: { label: 'Đơn Bị Hủy', badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30', step: 0 },
  };

  return (
    <div className="min-h-screen bg-dark-950 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-slate-100">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Theo Dõi Đơn Hàng Real-Time</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-black text-white mt-1">
          Tra Cứu Thông Tin Đơn Hàng
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-light">
          Nhập <strong>Số điện thoại</strong> hoặc <strong>Mã đơn hàng</strong> để kiểm tra tiến trình chế biến & giao hàng
        </p>

        {/* Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="mt-8 flex gap-2 max-w-md mx-auto"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="VD: 0987654321 hoặc ORD-DLV..."
              className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition disabled:opacity-50"
          >
            {loading ? 'Đang tìm...' : 'Tra Cứu'}
          </button>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="glass-card rounded-3xl p-10 text-center">
              <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-2" />
              <h3 className="font-serif font-bold text-white text-base">Không tìm thấy đơn hàng</h3>
              <p className="text-xs text-slate-400 mt-1">Vui lòng kiểm tra lại số điện thoại hoặc mã đơn hàng đã nhập.</p>
            </div>
          ) : (
            orders.map((order) => {
              const currentStatus = statusMap[order.status] || statusMap.pending;

              return (
                <div
                  key={order.id}
                  className="glass-card rounded-3xl p-6 sm:p-8 space-y-6 shadow-luxury"
                >
                  {/* Order Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/10">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400">Mã đơn hàng:</span>
                      <h3 className="font-serif text-lg font-black text-white">{order.code}</h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${currentStatus.badge}`}>
                        {currentStatus.label}
                      </span>
                      <p className="text-xl font-black text-amber-400 mt-1">
                        {order.totalAmount.toLocaleString('vi-VN')} đ
                      </p>
                    </div>
                  </div>

                  {/* Progress Stepper */}
                  {order.status !== 'cancelled' && (
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
                      <div className={`p-2.5 rounded-2xl border transition ${currentStatus.step >= 1 ? 'bg-amber-500/10 border-amber-500/50 text-amber-300' : 'bg-dark-850 border-white/5 text-slate-500'}`}>
                        1. Chờ duyệt
                      </div>
                      <div className={`p-2.5 rounded-2xl border transition ${currentStatus.step >= 2 ? 'bg-amber-500/10 border-amber-500/50 text-amber-300' : 'bg-dark-850 border-white/5 text-slate-500'}`}>
                        2. Bếp nấu
                      </div>
                      <div className={`p-2.5 rounded-2xl border transition ${currentStatus.step >= 3 ? 'bg-amber-500/10 border-amber-500/50 text-amber-300' : 'bg-dark-850 border-white/5 text-slate-500'}`}>
                        3. Đang giao
                      </div>
                      <div className={`p-2.5 rounded-2xl border transition ${currentStatus.step >= 4 ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300' : 'bg-dark-850 border-white/5 text-slate-500'}`}>
                        4. Hoàn thành
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="p-4 rounded-2xl bg-dark-850 border border-white/5 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-slate-400">Người nhận:</span>{' '}
                      <strong className="text-white">{order.customerName}</strong> ({order.customerPhone})
                    </div>
                    <div>
                      <span className="text-slate-400">Hình thức:</span>{' '}
                      <strong className="text-amber-400 uppercase">
                        {order.orderType === 'dine_in' ? `Tại bàn (${order.table?.tableNumber || 'Bàn'})` : order.orderType === 'takeout' ? 'Tự đến quán lấy' : 'Giao tận nơi'}
                      </strong>
                    </div>
                    {order.deliveryAddress && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400">Địa chỉ giao:</span>{' '}
                        <strong className="text-white">{order.deliveryAddress}</strong>
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Danh sách món ăn</h4>
                    {order.orderItems?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-xs p-3 rounded-2xl bg-dark-850 border border-white/5">
                        <div>
                          <span className="font-serif font-bold text-white">{item.dish.name}</span>
                          <span className="text-amber-400 font-semibold ml-2">x{item.quantity}</span>
                          {item.modifiers?.length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">+ {item.modifiers.map((m: any) => m.nameAtTime).join(', ')}</p>
                          )}
                        </div>
                        <span className="font-bold text-slate-200">{item.totalPrice.toLocaleString('vi-VN')} đ</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
