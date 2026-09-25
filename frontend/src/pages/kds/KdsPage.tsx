import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChefHat, 
  Clock, 
  CheckCircle, 
  Flame, 
  AlertCircle, 
  CheckCheck, 
  RefreshCw, 
  Volume2, 
  VolumeX,
  XCircle,
  Sparkles,
  LayoutDashboard
} from 'lucide-react';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

export const KdsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<number | 'all'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio play restricted by browser:', e);
    }
  };

  const loadKdsItems = async () => {
    try {
      const params: any = {};
      if (selectedStationId !== 'all') {
        params.stationId = selectedStationId;
      }
      const [itemsRes, stationsRes] = await Promise.all([
        api.get('/kds/items', { params }),
        api.get('/menu/stations'),
      ]);
      setItems(itemsRes.data);
      setStations(stationsRes.data);
    } catch (err) {
      console.error('Error loading KDS items:', err);
    }
  };

  useEffect(() => {
    loadKdsItems();

    function handleNewItems() {
      playChime();
      loadKdsItems();
    }

    function handleKdsUpdate() {
      loadKdsItems();
    }

    socket.on('order_items_added', handleNewItems);
    socket.on('kds_item_updated', handleKdsUpdate);

    const interval = setInterval(() => {
      setItems((prev) => [...prev]);
    }, 30000);

    return () => {
      socket.off('order_items_added', handleNewItems);
      socket.off('kds_item_updated', handleKdsUpdate);
      clearInterval(interval);
    };
  }, [selectedStationId, soundEnabled]);

  const handleUpdateStatus = async (itemId: number, nextStatus: string) => {
    try {
      await api.patch(`/kds/items/${itemId}/status`, { status: nextStatus });
      loadKdsItems();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái.');
    }
  };

  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    return Math.max(0, elapsed);
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white p-4 sm:p-6 lg:p-8">
      {/* KDS Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <span>Màn Hình Bếp Trưởng (KDS)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            </h1>
            <p className="text-xs text-slate-400">Phân luồng trạm chế biến thời gian thực • Chống quá tải giờ cao điểm</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-bold text-slate-300 hover:text-amber-400 transition"
          >
            <LayoutDashboard className="w-4 h-4 text-amber-400" />
            <span>Về Dashboard</span>
          </Link>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-3 rounded-2xl border transition ${
              soundEnabled
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-glow-emerald'
                : 'bg-dark-900 border-white/10 text-slate-500'
            }`}
            title="Bật/Tắt chuông báo"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={loadKdsItems}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/10 text-xs font-bold text-slate-200 transition"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* Station Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto py-5 scrollbar-none">
        <button
          onClick={() => setSelectedStationId('all')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            selectedStationId === 'all'
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-600/30'
              : 'bg-dark-900 text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          Tất Cả Các Trạm ({items.length})
        </button>

        {stations.map((st) => {
          const count = items.filter((i) => i.stationId === st.id).length;
          return (
            <button
              key={st.id}
              onClick={() => setSelectedStationId(st.id)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
                selectedStationId === st.id
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-dark-900 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {st.name} ({count})
            </button>
          );
        })}
      </div>

      {/* KDS Order Items Grid */}
      {items.length === 0 ? (
        <div className="py-32 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="font-serif text-xl font-bold text-slate-300">Tất cả các món đã được nấu xong!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Khi khách gọi món tại bàn hoặc đơn giao hàng mới tới, thẻ chế biến sẽ tự động xuất hiện và phát chuông báo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-2">
          {items.map((item) => {
            const minutes = getElapsedMinutes(item.createdAt);
            const isLate = minutes >= (item.dish?.preparationTimeMinutes || 10);

            const cardTheme = {
              pending: {
                border: 'border-amber-500/40 bg-dark-900 shadow-glow-amber',
                badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
                label: 'CHỜ BẾP NHẬN',
              },
              cooking: {
                border: 'border-orange-500 bg-dark-900 shadow-glow-orange',
                badge: 'bg-orange-500 text-white animate-pulse',
                label: 'ĐANG CHẾ BIẾN',
              },
              ready: {
                border: 'border-emerald-500 bg-emerald-950/20 shadow-glow-emerald',
                badge: 'bg-emerald-500 text-white',
                label: 'XONG - CHỜ BƯNG',
              },
            }[item.status as 'pending' | 'cooking' | 'ready'] || {
              border: 'border-white/10 bg-dark-900',
              badge: 'bg-white/10 text-slate-300',
              label: item.status,
            };

            return (
              <div
                key={item.id}
                className={`p-5 rounded-3xl border-2 flex flex-col justify-between transition-all duration-300 ${cardTheme.border}`}
              >
                <div>
                  {/* Top Bar: Table & Timer */}
                  <div className="flex items-start justify-between pb-3 border-b border-white/10">
                    <div>
                      <span className="font-serif text-2xl font-black text-white tracking-tight">
                        {item.order?.table?.tableNumber || 'Đơn Mang Về'}
                      </span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        Đợt {item.roundNumber} • {item.station?.name || 'Bếp'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black ${
                          isLate ? 'bg-rose-600 text-white animate-pulse' : 'bg-dark-850 text-slate-300 border border-white/10'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {minutes} phút
                      </span>
                      <span className={`block text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded-lg ${cardTheme.badge}`}>
                        {cardTheme.label}
                      </span>
                    </div>
                  </div>

                  {/* Main Dish Details */}
                  <div className="py-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-serif text-lg font-black text-white leading-tight">
                        {item.dish?.name}
                      </h3>
                      <span className="text-3xl font-black text-amber-400 shrink-0">
                        x{item.quantity}
                      </span>
                    </div>

                    {/* Modifiers */}
                    {item.modifiers?.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        {item.modifiers.map((mod: any) => (
                          <div key={mod.id} className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {mod.nameAtTime}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Kitchen Note */}
                    {item.kitchenNote && (
                      <div className="mt-3 p-2.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Ghi chú: {item.kitchenNote}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Big Action Buttons */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'cooking')}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2 transition hover:scale-[1.02]"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Bắt Đầu Nấu</span>
                    </button>
                  )}

                  {item.status === 'cooking' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'ready')}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition hover:scale-[1.02]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Nấu Xong (Báo Ra Món)</span>
                    </button>
                  )}

                  {item.status === 'ready' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'served')}
                      className="w-full py-3.5 rounded-2xl bg-dark-850 hover:bg-dark-800 text-emerald-400 font-black text-sm border border-emerald-500/30 flex items-center justify-center gap-2 transition hover:scale-[1.02]"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Đã Bưng Lên Bàn</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`Bạn có chắc muốn hủy món ${item.dish?.name}?`)) {
                        handleUpdateStatus(item.id, 'cancelled');
                      }
                    }}
                    className="w-full py-2 rounded-xl text-slate-500 hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Hủy Món Này</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
