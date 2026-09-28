import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  BellRing, 
  Plus, 
  Minus, 
  X, 
  ChefHat, 
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
    } catch {
      alert('Lỗi gửi yêu cầu thanh toán.');
    }
  };

  if (!tableData) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4 text-wood-600 font-serif">
        Đang khởi tạo bàn ăn...
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
    <div className="min-h-screen bg-cream-50 text-wood-900 pb-36 font-sans">
      {/* Table Digital Concierge Header Bar */}
      <div className="bg-white/95 backdrop-blur-md border-b border-wood-200 p-4 sticky top-0 z-30 shadow-subtle">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-lotus-800 flex items-center justify-center text-cream-50 font-serif font-bold text-lg shadow-subtle shrink-0">
              {tableData.tableNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base sm:text-lg text-lotus-900">{tableData.tableNumber}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-lotus-100 text-lotus-800 text-[10px] font-bold">
                  {tableData.areaName}
                </span>
              </div>
              <p className="text-[11px] text-wood-500">Gọi món trực tiếp vào bếp • Cập nhật thời gian thực</p>
            </div>
          </div>

          {currentOrder && (
            <button
              onClick={handleRequestBill}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ochre-600 hover:bg-ochre-700 text-white font-bold text-xs shadow-subtle transition active:scale-95"
            >
              <BellRing className="w-3.5 h-3.5 animate-bounce" />
              <span>Gọi Tính Tiền</span>
            </button>
          )}
        </div>

        {/* Tab switchers: Thực đơn vs Món đã gọi */}
        <div className="max-w-4xl mx-auto mt-3 flex rounded-xl bg-cream-100 p-1 border border-wood-200">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'menu'
                ? 'bg-lotus-800 text-cream-50 shadow-sm'
                : 'text-wood-600 hover:text-wood-900'
            }`}
          >
            Thực Đơn Gọi Món
          </button>
          <button
            onClick={() => setActiveTab('ordered')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'ordered'
                ? 'bg-lotus-800 text-cream-50 shadow-sm'
                : 'text-wood-600 hover:text-wood-900'
            }`}
          >
            <span>Món Đã Gọi Tại Bàn</span>
            {currentOrder?.orderItems?.length > 0 && (
              <span className="px-2 py-0.2 bg-ochre-600 text-white text-[10px] font-bold rounded-full">
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
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCatId === 'all'
                    ? 'bg-lotus-800 text-cream-50 shadow-sm'
                    : 'bg-white text-wood-700 border border-wood-200'
                }`}
              >
                Tất cả
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCatId === cat.id
                      ? 'bg-lotus-800 text-cream-50 shadow-sm'
                      : 'bg-white text-wood-700 border border-wood-200'
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
                  className={`bg-white p-4 rounded-2xl flex gap-4 shadow-subtle border border-wood-200 transition hover:border-lotus-300 ${
                    !dish.isAvailable ? 'opacity-60 grayscale' : ''
                  }`}
                >
                  <img
                    src={dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                    alt={dish.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shrink-0 bg-cream-100"
                    onError={(e: any) => {
                      e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
                    }}
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-sm sm:text-base text-wood-900">{dish.name}</h4>
                      <p className="text-xs text-wood-600 line-clamp-1 mt-0.5 font-serif">{dish.description}</p>
                      {dish.modifierGroups?.length > 0 && (
                        <p className="text-[10px] text-ochre-700 font-medium mt-1">
                          + Tùy chọn: {dish.modifierGroups.map((m: any) => m.modifierGroup.name).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-wood-100">
                      <span className="font-bold text-sm sm:text-base text-lotus-800">
                        {(dish.discountedPrice || dish.price).toLocaleString('vi-VN')} đ
                      </span>

                      {dish.isAvailable ? (
                        <button
                          onClick={() => openCustomizer(dish)}
                          className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 text-xs font-bold shadow-subtle transition active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-wood-500 bg-cream-200 px-2 py-1 rounded-lg">
                          Tạm hết
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
              <div className="bg-white rounded-3xl p-10 text-center border border-wood-200 shadow-subtle">
                <ChefHat className="w-12 h-12 text-wood-400 mx-auto mb-2" />
                <h3 className="font-serif font-bold text-wood-900 text-lg">Chưa có món nào được gọi</h3>
                <p className="text-xs text-wood-600 mt-1 font-serif">Vui lòng quay lại tab Thực Đơn để chọn món cho bàn nhé!</p>
              </div>
            ) : (
              <div>
                <div className="bg-white rounded-2xl p-5 mb-6 flex items-center justify-between border border-wood-200 shadow-subtle">
                  <div>
                    <span className="text-[11px] text-wood-500">Mã đơn bàn: {currentOrder.code}</span>
                    <h3 className="text-sm font-bold text-wood-900">Tổng tiền tạm tính hiện tại:</h3>
                  </div>
                  <span className="text-xl font-serif font-bold text-lotus-900">
                    {currentOrder.totalAmount.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-wood-700 mb-3">
                  Tiến độ chế biến thời gian thực
                </h4>

                <div className="space-y-3">
                  {currentOrder.orderItems.map((item: any) => {
                    const statusConfig: Record<string, { label: string; badge: string; pulse?: boolean }> = {
                      pending: { label: 'Bếp Đang Nhận', badge: 'bg-ochre-100 text-ochre-800 border border-ochre-300' },
                      cooking: { label: 'Đang Nấu Trên Bếp', badge: 'bg-lotus-800 text-cream-50', pulse: true },
                      ready: { label: 'Món Đã Xong (Đang Ra)', badge: 'bg-lotus-700 text-cream-50' },
                      served: { label: 'Đã Phục Vụ', badge: 'bg-cream-200 text-wood-700 border border-wood-300' },
                      cancelled: { label: 'Đã Hủy', badge: 'bg-terracotta/20 text-terracotta border border-terracotta/30' },
                    };

                    const currentStatus = statusConfig[item.status] || statusConfig.pending;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl p-4 flex items-center justify-between border border-wood-200 shadow-subtle"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-wood-900">{item.dish.name}</span>
                            <span className="text-xs font-bold text-lotus-800">x{item.quantity}</span>
                            <span className="px-2 py-0.5 rounded-full bg-cream-100 text-[10px] text-wood-600 font-medium">
                              Đợt {item.roundNumber}
                            </span>
                          </div>

                          {item.modifiers?.length > 0 && (
                            <p className="text-[11px] text-wood-500 mt-1">
                              + {item.modifiers.map((m: any) => m.nameAtTime).join(', ')}
                            </p>
                          )}

                          {item.kitchenNote && (
                            <p className="text-[10px] text-ochre-700 italic mt-0.5">
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
                          <p className="text-xs font-bold text-wood-900 mt-1">
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-wood-200 shadow-2xl z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-lotus-800 text-cream-50 font-bold text-xs flex items-center justify-center">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
                <span className="text-xs font-bold text-wood-800">Món trong giỏ</span>
              </div>
              <p className="text-base font-serif font-bold text-lotus-900">
                {cartTotalAmount.toLocaleString('vi-VN')} đ
              </p>
            </div>

            <button
              onClick={handleSendOrderToKitchen}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs shadow-subtle transition disabled:opacity-50 active:scale-95"
            >
              <ChefHat className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Vào Bếp Nấu'}</span>
            </button>
          </div>
        </div>
      )}

      {/* DISH CUSTOMIZER MODAL */}
      {selectedDish && (
        <div className="fixed inset-0 bg-wood-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cream-50 border border-wood-200 w-full max-w-md rounded-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl text-wood-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-wood-200">
              <div>
                <h3 className="font-serif text-lg font-bold text-lotus-900">{selectedDish.name}</h3>
                <span className="text-sm font-bold text-lotus-800">
                  {(selectedDish.discountedPrice || selectedDish.price).toLocaleString('vi-VN')} đ
                </span>
              </div>
              <button
                onClick={() => setSelectedDish(null)}
                className="p-1.5 rounded-lg text-wood-400 hover:text-wood-800 bg-cream-100 border border-wood-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {selectedDish.modifierGroups?.map((mg: any) => {
                const group = mg.modifierGroup;
                const isSingle = group.maxSelect === 1;

                return (
                  <div key={group.id} className="border-b border-wood-200 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-wood-800">{group.name}</label>
                      <span className="text-[10px] text-wood-500">
                        {group.isRequired ? 'Bắt buộc chọn' : 'Tùy chọn'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items?.map((item: any) => {
                        const isChecked = modalModifiers.includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                              isChecked
                                ? 'bg-lotus-50 border-lotus-600 text-lotus-900 font-bold shadow-subtle'
                                : 'bg-white border-wood-200 text-wood-700'
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
                                className="accent-lotus-700"
                              />
                              <span>{item.name}</span>
                            </div>
                            {item.additionalPrice > 0 && (
                              <span className="text-lotus-800 font-bold">
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
                <label className="block text-xs font-bold text-wood-800 mb-1">Ghi chú cho bếp</label>
                <input
                  type="text"
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="Ví dụ: Ít cay, không ngò rí..."
                  className="w-full bg-white border border-wood-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-lotus-600 shadow-subtle"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-wood-800">Số lượng:</span>
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-wood-200 shadow-subtle">
                  <button
                    onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                    className="w-7 h-7 rounded-lg bg-cream-100 text-wood-700 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-sm w-4 text-center text-lotus-900">{modalQty}</span>
                  <button
                    onClick={() => setModalQty(modalQty + 1)}
                    className="w-7 h-7 rounded-lg bg-cream-100 text-wood-700 flex items-center justify-center font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full py-3 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs shadow-subtle transition mt-2 active:scale-98"
            >
              Thêm Vào Đơn Gọi Món
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default TableOrderPage;
