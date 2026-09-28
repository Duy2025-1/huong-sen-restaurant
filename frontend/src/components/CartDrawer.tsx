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
  Banknote, 
  CheckCircle2, 
  QrCode
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
    <div className="fixed inset-0 z-50 overflow-hidden font-sans text-wood-900">
      {/* Backdrop */}
      <div
        onClick={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(false);
        }}
        className="absolute inset-0 bg-wood-950/60 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-cream-50 border-l border-wood-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-wood-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-lotus-100 text-lotus-800 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-base sm:text-lg text-lotus-900">
                  Giỏ Món Hương Sen
                </h2>
                <span className="text-[11px] text-wood-500">{totalItemCount} món đang chọn</span>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-wood-400 hover:text-wood-800 bg-cream-100 hover:bg-cream-200 border border-wood-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-8 h-8 text-wood-400" />
                </div>
                <h3 className="font-serif font-bold text-wood-900 text-base">Giỏ món chưa có gì</h3>
                <p className="text-xs text-wood-600 mt-1 max-w-xs font-serif leading-relaxed">
                  Hãy ghé thăm thực đơn và chọn cho mình những phong vị quê nhà thơm ngon nhé!
                </p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white border border-wood-200 flex gap-3 relative group transition hover:border-lotus-400 shadow-subtle"
                >
                  <img
                    src={item.dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                    alt={item.dish.name}
                    className="w-16 h-16 rounded-xl object-cover bg-cream-100 shrink-0"
                  />
                  <div className="flex-1 pr-6">
                    <h4 className="font-serif font-bold text-sm text-wood-900 leading-snug">{item.dish.name}</h4>

                    {item.selectedModifiers?.length > 0 && (
                      <p className="text-[10px] text-ochre-700 mt-0.5">
                        + {item.selectedModifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}

                    {item.kitchenNote && (
                      <p className="text-[10px] text-wood-500 italic mt-0.5">Ghi chú: {item.kitchenNote}</p>
                    )}

                    <div className="flex items-center justify-between mt-2.5">
                      <span className="font-bold text-xs text-lotus-800">
                        {item.itemTotalPrice.toLocaleString('vi-VN')} đ
                      </span>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 bg-cream-100 px-2 py-0.5 rounded-lg border border-wood-200">
                        <button
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="text-wood-600 hover:text-wood-900 font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs w-4 text-center text-lotus-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="text-wood-600 hover:text-wood-900 font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="absolute top-3 right-3 p-1 text-wood-400 hover:text-terracotta transition"
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
            <div className="p-5 border-t border-wood-200 bg-white">
              <div className="flex justify-between items-baseline mb-4">
                <span className="text-xs font-semibold text-wood-600">Tổng tiền tạm tính:</span>
                <span className="text-xl font-serif font-bold text-lotus-900">
                  {cartTotal.toLocaleString('vi-VN')} đ
                </span>
              </div>

              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full py-3.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-sm shadow-subtle flex items-center justify-center gap-2 transition active:scale-98"
              >
                <span>Tiến Hành Đặt Món</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-wood-950/70 backdrop-blur-sm">
          <div className="bg-cream-50 border border-wood-200 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto text-wood-900 animate-in zoom-in-95 duration-150">
            {orderSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-lotus-800 text-cream-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-subtle">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <span className="text-xs font-bold text-ochre-700 uppercase tracking-widest">Đã Ghi Nhận Thành Công</span>
                <h3 className="font-serif text-2xl font-bold text-lotus-900 mt-1">Hương Sen Đã Nhận Đơn Món!</h3>
                <p className="text-xs text-wood-600 mt-1">
                  Mã tra cứu đơn: <strong className="text-lotus-800 text-base font-bold">{orderSuccess.code}</strong>
                </p>

                <div className="mt-6 p-5 rounded-2xl bg-white border border-wood-200 text-left text-xs space-y-2.5 shadow-subtle">
                  <div className="flex justify-between">
                    <span className="text-wood-600">Khách hàng:</span>
                    <span className="font-bold text-wood-900">{orderSuccess.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-wood-600">Số điện thoại:</span>
                    <span className="font-bold text-wood-900">{orderSuccess.customerPhone}</span>
                  </div>
                  {orderSuccess.deliveryAddress && (
                    <div className="flex justify-between">
                      <span className="text-wood-600">Địa chỉ giao:</span>
                      <span className="font-bold text-wood-900">{orderSuccess.deliveryAddress}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-wood-100">
                    <span className="text-wood-600 font-bold">Tổng thanh toán:</span>
                    <span className="font-serif font-bold text-lotus-800 text-base">
                      {orderSuccess.totalAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <a
                    href={`/order-lookup?q=${orderSuccess.code}`}
                    className="flex-1 py-3 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs text-center shadow-subtle transition"
                  >
                    Xem Chi Tiết & Tra Cứu Đơn
                  </a>
                  <button
                    onClick={() => {
                      setOrderSuccess(null);
                      setIsCheckoutOpen(false);
                      setIsCartOpen(false);
                    }}
                    className="py-3 px-5 rounded-xl bg-white text-wood-700 hover:bg-cream-100 border border-wood-200 text-xs font-bold transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-wood-200 mb-6">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-lotus-900">Thông Tin Giao Món</h3>
                    <p className="text-xs text-wood-600">Bếp sẽ chuẩn bị ngay sau khi nhận được yêu cầu</p>
                  </div>
                  <button
                    onClick={() => setIsCheckoutOpen(false)}
                    className="p-1.5 rounded-lg text-wood-400 hover:text-wood-800 bg-cream-100 border border-wood-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {/* Order Type Tabs */}
                  <div className="grid grid-cols-2 gap-2 bg-cream-100 p-1 rounded-xl border border-wood-200">
                    <button
                      type="button"
                      onClick={() => setOrderType('delivery')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition ${
                        orderType === 'delivery'
                          ? 'bg-lotus-800 text-cream-50 shadow-sm'
                          : 'text-wood-600 hover:text-wood-900'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Giao Tận Nơi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('takeout')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition ${
                        orderType === 'takeout'
                          ? 'bg-lotus-800 text-cream-50 shadow-sm'
                          : 'text-wood-600 hover:text-wood-900'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Tự Đến Lấy</span>
                    </button>
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label className="block text-xs font-bold text-wood-800 mb-1">Họ và tên quý khách *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full bg-white border border-wood-200 rounded-xl px-3.5 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                    />
                  </div>

                  {/* Customer Phone */}
                  <div>
                    <label className="block text-xs font-bold text-wood-800 mb-1">Số điện thoại *</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0901234567"
                      className="w-full bg-white border border-wood-200 rounded-xl px-3.5 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                    />
                  </div>

                  {/* Address (Delivery only) */}
                  {orderType === 'delivery' && (
                    <div>
                      <label className="block text-xs font-bold text-wood-800 mb-1">Địa chỉ nhận hàng *</label>
                      <input
                        type="text"
                        required
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                        className="w-full bg-white border border-wood-200 rounded-xl px-3.5 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                      />
                    </div>
                  )}

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-bold text-wood-800 mb-1">Ghi chú cho shipper / bếp</label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ví dụ: Giao lên lầu 2, gọi trước khi tới..."
                      className="w-full bg-white border border-wood-200 rounded-xl px-3.5 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-bold text-wood-800 mb-1.5">Hình thức thanh toán</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition ${
                          paymentMethod === 'cod'
                            ? 'bg-lotus-50 border-lotus-600 text-lotus-900 font-bold shadow-subtle'
                            : 'bg-white border-wood-200 text-wood-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payMethod"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          className="text-lotus-700 focus:ring-lotus-600 accent-lotus-700"
                        />
                        <Banknote className="w-4 h-4 text-lotus-800" />
                        <span>Tiền mặt khi nhận (COD)</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-3 rounded-xl border text-xs cursor-pointer transition ${
                          paymentMethod === 'vnpay'
                            ? 'bg-lotus-50 border-lotus-600 text-lotus-900 font-bold shadow-subtle'
                            : 'bg-white border-wood-200 text-wood-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payMethod"
                          checked={paymentMethod === 'vnpay'}
                          onChange={() => setPaymentMethod('vnpay')}
                          className="text-lotus-700 focus:ring-lotus-600 accent-lotus-700"
                        />
                        <QrCode className="w-4 h-4 text-ochre-700" />
                        <span>VietQR / Chuyển khoản</span>
                      </label>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 rounded-2xl bg-white border border-wood-200 text-xs space-y-1.5 shadow-subtle">
                    <div className="flex justify-between text-wood-600">
                      <span>Tổng tiền món ({totalItemCount} phần):</span>
                      <span className="font-bold text-wood-900">{cartTotal.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between text-wood-600">
                      <span>Phí giao hàng:</span>
                      <span className="text-lotus-800 font-bold">Miễn phí giao hàng nội thành</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-wood-100 font-bold">
                      <span className="text-wood-900">Tổng cộng:</span>
                      <span className="font-serif text-base text-lotus-900">
                        {cartTotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 disabled:opacity-50 text-cream-50 font-bold text-sm shadow-subtle transition flex items-center justify-center gap-2"
                  >
                    <span>{isSubmitting ? 'Đang gửi đơn...' : 'Xác Nhận Đặt Món'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
