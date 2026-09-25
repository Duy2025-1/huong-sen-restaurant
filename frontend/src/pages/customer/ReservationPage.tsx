import React, { useState } from 'react';
import { Calendar, Users, Clock, Phone, User, CheckCircle2, FileText, Crown, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';

export const ReservationPage: React.FC = () => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [reservationTime, setReservationTime] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/reservations', {
        customerName,
        customerPhone,
        guestCount,
        reservationTime,
        note,
      });

      setConfirmedReservation(res.data.reservation);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi đặt bàn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-slate-100">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>Tiếp Đón Chu Đáo & Đẳng Cấp</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-black text-white mt-1">
          Đặt Bàn Trước Tại Hương Sen
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-3 max-w-lg mx-auto font-light leading-relaxed">
          Quý khách vui lòng đặt bàn trước 1-2 tiếng để đội ngũ chuẩn bị vị trí ngắm cảnh đẹp nhất và set-up bàn chu đáo.
        </p>
      </div>

      {confirmedReservation ? (
        <div className="glass-card rounded-3xl p-8 sm:p-10 border border-amber-500/30 shadow-luxury text-center max-w-lg mx-auto animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-orange-500/30">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Thành Công</span>
          <h2 className="font-serif text-2xl font-black text-white mt-1">Đặt Bàn Đã Được Xác Nhận!</h2>
          <p className="text-xs text-slate-400 mt-1">
            Mã đặt chỗ: <strong className="text-amber-400 text-sm font-black">#RES-{confirmedReservation.id}</strong>
          </p>

          <div className="mt-6 p-5 rounded-2xl bg-dark-850 border border-white/10 text-left space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Khách hàng:</span>
              <span className="font-bold text-white">{confirmedReservation.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số điện thoại:</span>
              <span className="font-bold text-white">{confirmedReservation.customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số lượng khách:</span>
              <span className="font-bold text-amber-400">{confirmedReservation.guestCount} người</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Thời gian dùng bữa:</span>
              <span className="font-bold text-amber-400">
                {new Date(confirmedReservation.reservationTime).toLocaleString('vi-VN')}
              </span>
            </div>
            {confirmedReservation.note && (
              <div className="pt-2 border-t border-white/5">
                <span className="text-slate-400">Yêu cầu đặc biệt:</span>
                <p className="font-medium text-slate-300 italic mt-0.5">{confirmedReservation.note}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setConfirmedReservation(null)}
            className="mt-6 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-500/25 transition"
          >
            Đặt Thêm Bàn Khác
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-6 sm:p-10 shadow-luxury border border-white/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Họ và tên quý khách *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                </div>
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Số điện thoại liên hệ *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                </div>
              </div>

              {/* Số lượng khách */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Số lượng khách dùng bữa *</label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                </div>
              </div>

              {/* Ngày giờ đặt */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Ngày & Giờ dùng bữa *</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="datetime-local"
                    required
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                </div>
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Yêu cầu đặc biệt (Chọn phòng VIP, bàn gần cửa sổ, sinh nhật...)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Bàn gần view thành phố, chuẩn bị nến sinh nhật..."
                  className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-orange-500/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Đang gửi thông tin...' : 'Xác Nhận Đặt Bàn Giữ Chỗ'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
