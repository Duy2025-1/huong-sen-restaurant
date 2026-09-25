import React, { useState } from 'react';
import { 
  ShoppingBag, 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  Truck, 
  Store, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  Sparkles,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export const CartDrawer: React.FC = () => {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, clearCart, cartTotal, totalItemCount } = useCart();
  const { user } = useAuth();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [orderType, setOrderType] = useState<'delivery' | 'takeout'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vnpay'>('cod');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  if (!isCartOpen) return null;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      alert('Vui lòng nhập họ tên người nhận.');
      return;
    }
    if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone.trim())) {
      alert('Vui lòng nhập số điện thoại hợp lệ gồm 10 chữ số tại Việt Nam.');
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      alert('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerName,
        customerPhone,
        deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
        orderType,
        paymentMethod,
        note,
        items: cart.map((i) => ({
          dishId: i.dish.id,
          quantity: i.quantity,
          modifierItemIds: i.selectedModifiers.map((m) => m.id),
          kitchenNote: i.kitchenNote,
        })),
      };

      const res = await api.post('/orders/delivery', payload);
      setOrderSuccess(res.data.order);
      clearCart();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đặt hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-slate-100">
      {/* Backdrop */}
      <div
        onClick={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(false);
        }}
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-md transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-dark-900 border-l border-white/10 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-dark-950">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <h2 className="font-serif font-bold text-lg text-white">Giỏ Hàng Của Bạn ({totalItemCount})</h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-dark-850 border border-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <ShoppingBag className="w-16 h-16 text-slate-700 mb-3" />
                <h3 className="font-serif font-bold text-slate-300 text-lg">Giỏ hàng đang rỗng</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs font-light">
                  Hãy dạo một vòng thực đơn và chọn những món ăn ngon miệng nhé!
                </p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-dark-850 border border-white/5 flex gap-3 relative group transition hover:border-amber-500/30"
                >
                  <img
                    src={item.dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                    alt={item.dish.name}
                    className="w-18 h-18 rounded-2xl object-cover bg-dark-900 shrink-0"
                  />
                  <div className="flex-1 pr-6">
                    <h4 className="font-serif font-bold text-sm text-white leading-snug">{item.dish.name}</h4>

                    {item.selectedModifiers?.length > 0 && (
                      <p className="text-[10px] text-amber-400 mt-1">
                        + {item.selectedModifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}

                    {item.kitchenNote && (
                      <p className="text-[10px] text-slate-400 italic mt-0.5">Ghi chú: {item.kitchenNote}</p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <span className="font-black text-xs text-amber-400">
                        {item.itemTotalPrice.toLocaleString('vi-VN')} đ
                      </span>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 bg-dark-900 px-2 py-0.5 rounded-xl border border-white/10">
                        <button
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-extrabold text-xs w-4 text-center text-amber-400">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-rose-400 transition"
                    title="Xóa món"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer with Subtotal & Checkout Button */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-white/10 bg-dark-950">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold text-slate-400">Tổng thanh toán:</span>
                <span className="text-xl font-black text-amber-400">
                  {cartTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Tiến Hành Đặt Hàng</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md">
          <div className="bg-dark-900 border border-white/10 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-100 animate-in zoom-in-95 duration-150">
            {orderSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Đã Ghi Nhận</span>
                <h3 className="font-serif text-2xl font-black text-white mt-1">Đặt Hàng Thành Công!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mã đơn hàng: <strong className="text-amber-400 text-base font-black">{orderSuccess.code}</strong>
                </p>

                <div className="mt-6 p-5 rounded-2xl bg-dark-850 border border-white/10 text-left text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Khách hàng:</span>
                    <span className="font-bold text-white">{orderSuccess.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số điện thoại:</span>
                    <span className="font-bold text-white">{orderSuccess.customerPhone}</span>
                  </div>
                  {orderSuccess.deliveryAddress && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Địa chỉ giao:</span>
                      <span className="font-bold text-white">{orderSuccess.deliveryAddress}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-slate-400 font-bold">Tổng thanh toán:</span>
                    <span className="font-black text-amber-400 text-base">
                      {orderSuccess.totalAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <a
                    href={`/order-lookup?q=${orderSuccess.code}`}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs text-center shadow-md transition hover:scale-105"
                  >
                    Xem Chi Tiết & Tra Cứu Đơn
                  </a>
                  <button
                    onClick={() => {
                      setOrderSuccess(null);
                      setIsCheckoutOpen(false);
                      setIsCartOpen(false);
                    }}
                    className="py-3.5 px-5 rounded-2xl bg-dark-850 text-slate-300 font-bold text-xs hover:bg-dark-800 transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <h3 className="font-serif font-black text-xl text-white">Giao Hàng & Thanh Toán</h3>
                  <button
                    onClick={() => setIsCheckoutOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white bg-dark-850"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCheckoutSubmit} className="py-5 space-y-4">
                  {/* Order Type Tabs */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderType('delivery')}
                      className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        orderType === 'delivery'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-glow-amber'
                          : 'bg-dark-850 border-white/5 text-slate-400'
                      }`}
                    >
                      <Truck className="w-4 h-4 text-amber-400" />
                      <span>Giao Tận Nơi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOrderType('takeout')}
                      className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        orderType === 'takeout'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-glow-amber'
                          : 'bg-dark-850 border-white/5 text-slate-400'
                      }`}
                    >
                      <Store className="w-4 h-4 text-amber-400" />
                      <span>Tự Đến Quán Lấy</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Họ và tên người nhận *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Số điện thoại liên hệ *</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0901234567"
                      className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {orderType === 'delivery' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">Địa chỉ giao hàng chi tiết *</label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Số nhà, tên đường, phường, quận..."
                        className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Phương thức thanh toán</label>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition ${
                          paymentMethod === 'cod' 
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold' 
                            : 'bg-dark-850 border-white/5 text-slate-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          className="accent-amber-500"
                        />
                        <Banknote className="w-4 h-4 text-emerald-400" />
                        <span>Tiền mặt (COD)</span>
                      </label>

                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition ${
                          paymentMethod === 'vnpay' 
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-bold' 
                            : 'bg-dark-850 border-white/5 text-slate-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === 'vnpay'}
                          onChange={() => setPaymentMethod('vnpay')}
                          className="accent-amber-500"
                        />
                        <CreditCard className="w-4 h-4 text-blue-400" />
                        <span>VietQR / MoMo</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Ghi chú cho đơn hàng</label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ghi chú thời gian nhận, đồ ăn kèm..."
                      className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Tổng thanh toán:</span>
                      <span className="text-xl font-black text-amber-400">
                        {cartTotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs shadow-xl shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? 'Đang gửi...' : 'Xác Nhận Đặt Hàng'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
