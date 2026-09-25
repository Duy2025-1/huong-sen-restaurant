import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Utensils, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  BellRing, 
  Flame, 
  Plus, 
  Minus, 
  X, 
  ChefHat, 
  Receipt,
  Sparkles,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

interface CartItem {
  dish: any;
  quantity: number;
  selectedModifiers: any[];
  kitchenNote: string;
  itemTotalPrice: number;
}

export const TableOrderPage: React.FC = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [tableData, setTableData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'menu' | 'ordered'>('menu');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal customizer state
  const [selectedDish, setSelectedDish] = useState<any | null>(null);
  const [modalModifiers, setModalModifiers] = useState<number[]>([]);
  const [modalNote, setModalNote] = useState('');
  const [modalQty, setModalQty] = useState(1);

  // Active table order
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  // Fetch Table & Menu
  const loadTableAndMenu = async () => {
    try {
      const [tableRes, menuRes] = await Promise.all([
        api.get(`/tables/by-token/${qrToken}`),
        api.get('/menu'),
      ]);
      setTableData(tableRes.data.table);
      setCurrentOrder(tableRes.data.currentOrder);
      setCategories(menuRes.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTableAndMenu();

    function handleKdsUpdate(data: any) {
      if (currentOrder && data.orderId === currentOrder.id) {
        api.get(`/tables/by-token/${qrToken}`).then((res) => {
          setCurrentOrder(res.data.currentOrder);
        });
      }
    }

    function handleOrderItemsAdded(data: any) {
      if (currentOrder && data.orderId === currentOrder.id) {
        api.get(`/tables/by-token/${qrToken}`).then((res) => {
          setCurrentOrder(res.data.currentOrder);
        });
      }
    }

    socket.on('kds_item_updated', handleKdsUpdate);
    socket.on('order_items_added', handleOrderItemsAdded);

    return () => {
      socket.off('kds_item_updated', handleKdsUpdate);
      socket.off('order_items_added', handleOrderItemsAdded);
    };
  }, [qrToken, currentOrder?.id]);

  const openCustomizer = (dish: any) => {
    setSelectedDish(dish);
    setModalModifiers([]);
    setModalNote('');
    setModalQty(1);

    const preselected: number[] = [];
    dish.modifierGroups?.forEach((mg: any) => {
      if (mg.modifierGroup.isRequired && mg.modifierGroup.items?.length > 0) {
        preselected.push(mg.modifierGroup.items[0].id);
      }
    });
    setModalModifiers(preselected);
  };

  const handleAddToCart = () => {
    if (!selectedDish) return;

    let extraPrice = 0;
    const chosenMods: any[] = [];

    selectedDish.modifierGroups?.forEach((mg: any) => {
      mg.modifierGroup.items.forEach((item: any) => {
        if (modalModifiers.includes(item.id)) {
          extraPrice += item.additionalPrice;
          chosenMods.push(item);
        }
      });
    });

    const unitPrice = selectedDish.discountedPrice || selectedDish.price;
    const itemTotalPrice = (unitPrice + extraPrice) * modalQty;

    setCart([
      ...cart,
      {
        dish: selectedDish,
        quantity: modalQty,
        selectedModifiers: chosenMods,
        kitchenNote: modalNote,
        itemTotalPrice,
      },
    ]);

    setSelectedDish(null);
  };

  const handleSendOrderToKitchen = async () => {
    if (!cart.length) return;
    setIsSubmitting(true);

    try {
      const payload = {
        qrToken,
        items: cart.map((item) => ({
          dishId: item.dish.id,
          quantity: item.quantity,
          modifierItemIds: item.selectedModifiers.map((m) => m.id),
          kitchenNote: item.kitchenNote,
        })),
      };

      const res = await api.post('/orders/dine-in', payload);
      setCurrentOrder(res.data.order);
      setCart([]);
      setActiveTab('ordered');

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi gửi order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestBill = async () => {
    if (!currentOrder) return;
    try {
      await api.post(`/orders/${currentOrder.id}/request-bill`);
      alert('🔔 Đã gửi yêu cầu thanh toán tới quầy Thu ngân! Nhân viên sẽ mang hóa đơn tới bàn ngay.');
    } catch (err) {
      alert('Lỗi gửi yêu cầu thanh toán.');
    }
  };

  if (!tableData) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 text-slate-400 font-serif">
        Đang khởi tạo phiên bàn ăn...
      </div>
    );
  }

  const allDishes = categories.flatMap((c) => c.dishes);
  const filteredDishes =
    selectedCatId === 'all'
      ? allDishes
      : categories.find((c) => c.id === selectedCatId)?.dishes || [];

  const cartTotalAmount = cart.reduce((sum, item) => sum + item.itemTotalPrice, 0);

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 pb-36">
      {/* Table Digital Concierge Header Bar */}
      <div className="bg-dark-900/90 backdrop-blur-xl border-b border-white/10 p-4 sticky top-20 z-30 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center text-white font-serif font-black text-xl shadow-lg shadow-orange-500/25 shrink-0">
              {tableData.tableNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base sm:text-lg text-white">{tableData.tableNumber}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                  {tableData.areaName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Gọi món trực tiếp vào bếp • Đồng bộ thời gian thực</p>
            </div>
          </div>

          {currentOrder && (
            <button
              onClick={handleRequestBill}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs shadow-lg shadow-orange-600/30 transition hover:scale-105 active:scale-95"
            >
              <BellRing className="w-4 h-4 animate-bounce" />
              <span>Gọi Tính Tiền</span>
            </button>
          )}
        </div>

        {/* Tab switchers: Thực đơn vs Món đã gọi */}
        <div className="max-w-4xl mx-auto mt-4 flex rounded-2xl bg-dark-950/80 p-1 border border-white/5">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === 'menu'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Thực Đơn Gọi Món
          </button>
          <button
            onClick={() => setActiveTab('ordered')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'ordered'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Món Đã Gọi Tại Bàn</span>
            {currentOrder?.orderItems?.length > 0 && (
              <span className="px-2 py-0.2 bg-white text-orange-600 text-[10px] font-black rounded-full">
                {currentOrder.orderItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* VIEW 1: MENU CALLING */}
        {activeTab === 'menu' && (
          <div>
            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
              <button
                onClick={() => setSelectedCatId('all')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCatId === 'all'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-600/30'
                    : 'bg-dark-900 text-slate-400 border border-white/5'
                }`}
              >
                Tất cả
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCatId === cat.id
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-600/30'
                      : 'bg-dark-900 text-slate-400 border border-white/5'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Dish items list */}
            <div className="space-y-3">
              {filteredDishes.map((dish: any) => (
                <div
                  key={dish.id}
                  className={`glass-card p-4 rounded-3xl flex gap-4 shadow-luxury transition hover:border-amber-500/30 ${
                    !dish.isAvailable ? 'opacity-50 grayscale' : ''
                  }`}
                >
                  <img
                    src={dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                    alt={dish.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shrink-0 bg-dark-900"
                    onError={(e: any) => {
                      e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
                    }}
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm sm:text-base text-white">{dish.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-light">{dish.description}</p>
                      {dish.modifierGroups?.length > 0 && (
                        <p className="text-[10px] text-amber-400 font-semibold mt-1">
                          + Tùy chọn: {dish.modifierGroups.map((m: any) => m.modifierGroup.name).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <span className="font-black text-sm sm:text-base text-amber-400">
                        {(dish.discountedPrice || dish.price).toLocaleString('vi-VN')} đ
                      </span>

                      {dish.isAvailable ? (
                        <button
                          onClick={() => openCustomizer(dish)}
                          className="flex items-center gap-1 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-md shadow-orange-600/20 hover:scale-105 active:scale-95 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-950/40 px-2 py-1 rounded-lg">
                          Hết món (86)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: LIVE ORDERED ITEMS (KDS TRACKER) */}
        {activeTab === 'ordered' && (
          <div className="space-y-4">
            {!currentOrder || !currentOrder.orderItems?.length ? (
              <div className="glass-card rounded-3xl p-10 text-center">
                <ChefHat className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                <h3 className="font-serif font-bold text-white text-lg">Chưa có món nào được gọi</h3>
                <p className="text-xs text-slate-400 mt-1">Vui lòng quay lại tab Thực Đơn để chọn món cho bàn nhé!</p>
              </div>
            ) : (
              <div>
                <div className="glass-card rounded-3xl p-5 mb-6 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400">Mã đơn bàn: {currentOrder.code}</span>
                    <h3 className="text-sm font-bold text-white">Tổng tiền tạm tính hiện tại:</h3>
                  </div>
                  <span className="text-xl font-black text-amber-400">
                    {currentOrder.totalAmount.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Tiến độ chế biến thời gian thực (KDS Live)
                </h4>

                <div className="space-y-3">
                  {currentOrder.orderItems.map((item: any) => {
                    const statusConfig: Record<string, { label: string; badge: string; pulse?: boolean }> = {
                      pending: { label: 'Bếp Đang Nhận', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
                      cooking: { label: 'Đang Nấu Trên Bếp', badge: 'bg-orange-500 text-white shadow-glow-orange', pulse: true },
                      ready: { label: 'Món Đã Xong (Đang Ra)', badge: 'bg-emerald-500 text-white shadow-glow-emerald' },
                      served: { label: 'Đã Phục Vụ', badge: 'bg-dark-850 text-slate-400 border border-white/5' },
                      cancelled: { label: 'Đã Hủy', badge: 'bg-rose-950/40 text-rose-400 border border-rose-800/40' },
                    };

                    const currentStatus = statusConfig[item.status] || statusConfig.pending;

                    return (
                      <div
                        key={item.id}
                        className="glass-card rounded-3xl p-4 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-white">{item.dish.name}</span>
                            <span className="text-xs font-semibold text-amber-400">x{item.quantity}</span>
                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-400 font-medium">
                              Đợt {item.roundNumber}
                            </span>
                          </div>

                          {item.modifiers?.length > 0 && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              + {item.modifiers.map((m: any) => m.nameAtTime).join(', ')}
                            </p>
                          )}

                          {item.kitchenNote && (
                            <p className="text-[10px] text-amber-400 italic mt-0.5">
                              Ghi chú: {item.kitchenNote}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${currentStatus.badge} ${
                              currentStatus.pulse ? 'animate-pulse' : ''
                            }`}
                          >
                            {currentStatus.label}
                          </span>
                          <p className="text-xs font-black text-slate-200 mt-1">
                            {item.totalPrice.toLocaleString('vi-VN')} đ
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-dark-900/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xs flex items-center justify-center">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
                <span className="text-xs font-bold text-slate-300">Món trong giỏ</span>
              </div>
              <p className="text-lg font-black text-amber-400">
                {cartTotalAmount.toLocaleString('vi-VN')} đ
              </p>
            </div>

            <button
              onClick={handleSendOrderToKitchen}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-orange-600/30 transition disabled:opacity-50 hover:scale-105 active:scale-95"
            >
              <ChefHat className="w-5 h-5" />
              <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Vào Bếp Nấu'}</span>
            </button>
          </div>
        </div>
      )}

      {/* DISH CUSTOMIZER MODAL */}
      {selectedDish && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 w-full max-w-md rounded-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-serif text-lg font-bold text-white">{selectedDish.name}</h3>
                <span className="text-base font-black text-amber-400">
                  {(selectedDish.discountedPrice || selectedDish.price).toLocaleString('vi-VN')} đ
                </span>
              </div>
              <button
                onClick={() => setSelectedDish(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {selectedDish.modifierGroups?.map((mg: any) => {
                const group = mg.modifierGroup;
                const isSingle = group.maxSelect === 1;

                return (
                  <div key={group.id} className="border-b border-white/5 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-200">{group.name}</label>
                      <span className="text-[10px] text-slate-400">
                        {group.isRequired ? 'Bắt buộc chọn' : 'Tùy chọn'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items?.map((item: any) => {
                        const isChecked = modalModifiers.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                              isChecked
                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-bold'
                                : 'bg-dark-850 border-white/5 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type={isSingle ? 'radio' : 'checkbox'}
                                name={`group_${group.id}`}
                                checked={isChecked}
                                onChange={() => {
                                  if (isSingle) {
                                    const filtered = modalModifiers.filter(
                                      (id) => !group.items.some((i: any) => i.id === id)
                                    );
                                    setModalModifiers([...filtered, item.id]);
                                  } else {
                                    if (isChecked) {
                                      setModalModifiers(modalModifiers.filter((id) => id !== item.id));
                                    } else {
                                      setModalModifiers([...modalModifiers, item.id]);
                                    }
                                  }
                                }}
                                className="accent-amber-500"
                              />
                              <span>{item.name}</span>
                            </div>
                            {item.additionalPrice > 0 && (
                              <span className="text-amber-400 font-bold">
                                +{item.additionalPrice.toLocaleString('vi-VN')} đ
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">Ghi chú cho bếp</label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="Ví dụ: Ít đá, không hành..."
                  className="w-full bg-dark-850 border border-white/10 rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-200">Số lượng:</span>
                <div className="flex items-center gap-3 bg-dark-850 p-1 rounded-2xl border border-white/5">
                  <button
                    onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                    className="w-7 h-7 rounded-xl bg-dark-900 text-slate-300 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-extrabold text-sm w-4 text-center text-amber-400">{modalQty}</span>
                  <button
                    onClick={() => setModalQty(modalQty + 1)}
                    className="w-7 h-7 rounded-xl bg-dark-900 text-slate-300 flex items-center justify-center font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition mt-2"
            >
              Thêm Vào Đơn Gọi Món
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
