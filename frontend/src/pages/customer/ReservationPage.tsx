import React, { useState } from 'react';
import { Calendar, Users, Clock, Phone, User, CheckCircle2, FileText, Sparkles, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';

export const ReservationPage: React.FC = () => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [reservationTime, setReservationTime] = useState('');
  const [seatingArea, setSeatingArea] = useState('Sảnh Chính Mộc Mạc');
  const [specialNote, setSpecialNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const fullNote = seatingArea ? `[Khu vực: ${seatingArea}] ${specialNote}`.trim() : specialNote;

    try {
      const res = await api.post('/reservations', {
        customerName,
        customerPhone,
        guestCount,
        reservationTime,
        note: fullNote,
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
    <div className="min-h-screen bg-cream-50 py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-wood-900 font-sans">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-lotus-50 border border-lotus-200 text-lotus-800 text-xs font-semibold uppercase tracking-widest mb-3">
          <Sparkles className="w-3.5 h-3.5 text-ochre-600" />
          <span>Tiếp Đón Chu Đáo & Thân Tình</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl font-bold text-lotus-900 mt-1">
          Đặt Bàn Tại Hương Sen
        </h1>
        <p className="text-sm text-wood-600 mt-3 max-w-lg mx-auto font-serif leading-relaxed">
          Quý khách vui lòng đặt bàn trước 1-2 tiếng để đội ngũ chuẩn bị vị trí ngồi ưng ý nhất và giữ hương vị tươi mới cho bữa ăn đoàn viên.
        </p>
      </div>

      {confirmedReservation ? (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-wood-200 shadow-lift text-center max-w-lg mx-auto animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-lotus-800 text-cream-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-subtle">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <span className="text-xs font-bold text-ochre-700 uppercase tracking-widest">Đã Xác Nhận</span>
          <h2 className="font-serif text-2xl font-bold text-lotus-900 mt-1">Đặt Bàn Thành Công!</h2>
          <p className="text-xs text-wood-600 mt-1">
            Mã đặt bàn: <strong className="text-lotus-800 text-sm font-bold">#RES-{confirmedReservation.id}</strong>
          </p>

          <div className="mt-6 p-5 rounded-2xl bg-cream-50 border border-wood-200 text-left space-y-2.5 text-xs shadow-subtle">
            <div className="flex justify-between">
              <span className="text-wood-600">Khách hàng:</span>
              <span className="font-bold text-wood-900">{confirmedReservation.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-wood-600">Số điện thoại:</span>
              <span className="font-bold text-wood-900">{confirmedReservation.customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-wood-600">Số lượng khách:</span>
              <span className="font-bold text-lotus-800">{confirmedReservation.guestCount} người</span>
            </div>
            <div className="flex justify-between">
              <span className="text-wood-600">Thời gian dùng bữa:</span>
              <span className="font-bold text-lotus-800">
                {new Date(confirmedReservation.reservationTime).toLocaleString('vi-VN')}
              </span>
            </div>
            {confirmedReservation.note && (
              <div className="pt-2 border-t border-wood-200">
                <span className="text-wood-600">Yêu cầu đặc biệt:</span>
                <p className="font-medium text-wood-800 font-serif italic mt-0.5">{confirmedReservation.note}</p>
              </div>
            )}
          </div>

          <p className="text-xs text-wood-500 mt-4 italic font-serif">
            Hương Sen sẽ gọi điện xác nhận lại trước 30 phút. Hân hạnh được đón tiếp quý khách!
          </p>

          <button
            onClick={() => setConfirmedReservation(null)}
            className="mt-6 w-full py-3.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-sm shadow-subtle transition active:scale-98"
          >
            Đặt Thêm Bàn Khác
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-lift border border-wood-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-2">Họ và tên quý khách *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle transition"
                  />
                </div>
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-2">Số điện thoại liên hệ *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle transition"
                  />
                </div>
              </div>

              {/* Số lượng khách */}
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-2">Số lượng thực khách *</label>
                <div className="relative">
                  <Users className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle transition"
                  />
                </div>
              </div>

              {/* Ngày giờ đặt */}
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-2">Ngày & Giờ dùng bữa *</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="datetime-local"
                    required
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle transition"
                  />
                </div>
              </div>
            </div>

            {/* Khu vực ngồi mong muốn */}
            <div>
              <label className="block text-xs font-bold text-wood-800 mb-2">
                Không gian mong muốn
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'Sảnh Chính Mộc Mạc', title: 'Sảnh Chính Mộc Mạc', desc: 'Bàn gỗ lim, đèn lồng ấm cúng' },
                  { id: 'Hiên Vườn Trúc Xanh', title: 'Hiên Vườn Trúc Xanh', desc: 'Thoáng đãng, ngắm hồ sen mát lành' },
                  { id: 'Phòng VIP Gia Đình', title: 'Phòng Riêng VIP', desc: 'Không gian riêng tư, tiếp khách sang trọng' }
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between ${
                      seatingArea === item.id
                        ? 'bg-lotus-50 border-lotus-600 text-lotus-900 font-bold shadow-subtle'
                        : 'bg-cream-50 border-wood-200 text-wood-700 hover:border-wood-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="seatingArea"
                        checked={seatingArea === item.id}
                        onChange={() => setSeatingArea(item.id)}
                        className="text-lotus-700 focus:ring-lotus-600 accent-lotus-700"
                      />
                      <span className="font-serif font-bold text-wood-900">{item.title}</span>
                    </div>
                    <span className="text-[11px] text-wood-500 pl-5">{item.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-bold text-wood-800 mb-2">
                Yêu cầu thêm (Ghế trẻ em, ăn chay, kỷ niệm ngày cưới, sinh nhật...)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                <textarea
                  rows={3}
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  placeholder="Ví dụ: Có người lớn tuổi cần bàn gần lối đi, chuẩn bị bánh sinh nhật..."
                  className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-sm shadow-subtle transition-all active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Đang gửi thông tin...' : 'Xác Nhận Đặt Bàn Giữ Chỗ'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default ReservationPage;
