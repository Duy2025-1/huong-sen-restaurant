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
    pending: { label: 'Chờ Quán Tiếp Nhận', badge: 'bg-ochre-100 text-ochre-800 border border-ochre-300', step: 1 },
    preparing: { label: 'Bếp Đang Nấu Món', badge: 'bg-lotus-100 text-lotus-800 border border-lotus-200', step: 2 },
    ready: { label: 'Đang Giao Hàng', badge: 'bg-lotus-800 text-cream-50 border border-lotus-700', step: 3 },
    completed: { label: 'Đơn Đã Hoàn Tất', badge: 'bg-lotus-900 text-cream-50 border border-lotus-800', step: 4 },
    cancelled: { label: 'Đơn Bị Hủy', badge: 'bg-terracotta/15 text-terracotta border border-terracotta/30', step: 0 },
  };

  return (
    <div className="min-h-screen bg-cream-50 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-wood-900 font-sans">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-lotus-50 border border-lotus-200 text-lotus-800 text-xs font-semibold uppercase tracking-widest mb-3">
          <Sparkles className="w-3.5 h-3.5 text-ochre-600" />
          <span>Theo Dõi Tiến Trình Đơn Món</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-lotus-900 mt-1">
          Tra Cứu Đơn Hàng Hương Sen
        </h1>
        <p className="text-xs sm:text-sm text-wood-600 mt-2 font-serif leading-relaxed">
          Nhập <strong>Số điện thoại</strong> hoặc <strong>Mã đơn hàng</strong> (VD: ORD-...) để xem chi tiết món ăn và tiến trình chế biến.
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
            <Search className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="VD: 0987654321 hoặc ORD-..."
              className="w-full bg-white border border-wood-200 rounded-xl pl-11 pr-4 py-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs shadow-subtle transition disabled:opacity-50"
          >
            {loading ? 'Đang tìm...' : 'Tra Cứu'}
          </button>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-wood-200 shadow-subtle">
              <AlertCircle className="w-12 h-12 text-wood-400 mx-auto mb-2" />
              <h3 className="font-serif font-bold text-wood-900 text-base">Không tìm thấy đơn hàng phù hợp</h3>
              <p className="text-xs text-wood-600 mt-1">Vui lòng kiểm tra lại số điện thoại hoặc mã đơn hàng đã nhập.</p>
            </div>
          ) : (
            orders.map((order) => {
              const currentStatus = statusMap[order.status] || statusMap.pending;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-lift border border-wood-200"
                >
                  {/* Order Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-wood-200">
                    <div>
                      <span className="text-[11px] font-semibold text-wood-500 uppercase tracking-wider">Mã đơn hàng:</span>
                      <h3 className="font-serif text-xl font-bold text-lotus-900">{order.code}</h3>
                      <p className="text-[11px] text-wood-500 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-ochre-600" />
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${currentStatus.badge}`}>
                        {currentStatus.label}
                      </span>
                      <p className="font-serif text-xl font-bold text-lotus-800 mt-1">
                        {order.totalAmount.toLocaleString('vi-VN')} đ
                      </p>
                    </div>
                  </div>

                  {/* Progress Stepper */}
                  {order.status !== 'cancelled' && (
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
                      <div className={`p-2.5 rounded-xl border transition ${currentStatus.step >= 1 ? 'bg-lotus-100 border-lotus-300 text-lotus-900 font-bold' : 'bg-cream-100 border-wood-200 text-wood-400'}`}>
                        1. Quán nhận đơn
                      </div>
                      <div className={`p-2.5 rounded-xl border transition ${currentStatus.step >= 2 ? 'bg-lotus-100 border-lotus-300 text-lotus-900 font-bold' : 'bg-cream-100 border-wood-200 text-wood-400'}`}>
                        2. Bếp chuẩn bị
                      </div>
                      <div className={`p-2.5 rounded-xl border transition ${currentStatus.step >= 3 ? 'bg-lotus-100 border-lotus-300 text-lotus-900 font-bold' : 'bg-cream-100 border-wood-200 text-wood-400'}`}>
                        3. Đang giao món
                      </div>
                      <div className={`p-2.5 rounded-xl border transition ${currentStatus.step >= 4 ? 'bg-lotus-800 border-lotus-900 text-cream-50 font-bold' : 'bg-cream-100 border-wood-200 text-wood-400'}`}>
                        4. Hoàn tất
                      </div>
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="p-4 rounded-2xl bg-cream-50 border border-wood-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2.5 shadow-subtle">
                    <div>
                      <span className="text-wood-500">Khách hàng:</span>{' '}
                      <strong className="text-wood-900">{order.customerName}</strong> ({order.customerPhone})
                    </div>
                    <div>
                      <span className="text-wood-500">Hình thức:</span>{' '}
                      <strong className="text-lotus-800 uppercase">
                        {order.orderType === 'dine_in' ? `Tại bàn (${order.table?.tableNumber || 'Bàn'})` : order.orderType === 'takeout' ? 'Tự đến quán lấy' : 'Giao tận nơi'}
                      </strong>
                    </div>
                    {order.deliveryAddress && (
                      <div className="sm:col-span-2">
                        <span className="text-wood-500">Địa chỉ giao:</span>{' '}
                        <strong className="text-wood-900">{order.deliveryAddress}</strong>
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-wood-700">Món ăn trong đơn</h4>
                    {order.orderItems?.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-xs p-3 rounded-xl bg-cream-50 border border-wood-200 shadow-subtle">
                        <div>
                          <span className="font-serif font-bold text-wood-900">{item.dish.name}</span>
                          <span className="text-lotus-800 font-bold ml-2">x{item.quantity}</span>
                          {item.modifiers?.length > 0 && (
                            <p className="text-[10px] text-wood-500 mt-0.5">+ {item.modifiers.map((m: any) => m.nameAtTime).join(', ')}</p>
                          )}
                        </div>
                        <span className="font-bold text-wood-900">{item.totalPrice.toLocaleString('vi-VN')} đ</span>
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
export default OrderLookupPage;
