import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Utensils, 
  CalendarCheck, 
  Sparkles, 
  Clock, 
  MapPin, 
  Phone, 
  ArrowRight, 
  Star, 
  Crown, 
  ShieldCheck, 
  Award, 
  Flame, 
  Heart,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';

export const HomePage: React.FC = () => {
  const [featuredDishes, setFeaturedDishes] = useState<any[]>([]);

  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await api.get('/menu');
        const allDishes = res.data.flatMap((cat: any) => cat.dishes);
        const bestSellers = allDishes
          .filter((d: any) => d.isBestSeller && d.isAvailable)
          .sort((a: any, b: any) => (b.soldCount || 0) - (a.soldCount || 0));
        setFeaturedDishes(bestSellers.length > 0 ? bestSellers.slice(0, 4) : allDishes.slice(0, 4));
      } catch (e) {
        console.error(e);
      }
    }
    fetchMenu();
  }, []);

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 overflow-hidden">
      {/* 1. CINEMATIC HERO SECTION */}
      <section className="relative min-h-[92vh] flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
        {/* Background photo with luxury dark vignette */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transform animate-float transition-all duration-1000"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1544025162-d76694265947?w=1920&q=85')`,
            filter: 'brightness(0.28) contrast(1.15)',
          }}
        />
        
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-amber-600/20 via-orange-600/15 to-transparent blur-[140px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center z-10">
          {/* Royal Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dark-900/90 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-widest uppercase shadow-glow-amber mb-8 backdrop-blur-md">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Tinh Hoa Ẩm Thực Việt & Hải Sản Thượng Hạng</span>
          </div>

          {/* Majestic Title with Serif Typography */}
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Nơi Khởi Nguồn Của <br className="hidden sm:inline" />
            <span className="gold-gradient-text italic font-serif">Mỹ Vị Đẳng Cấp</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed mb-10">
            Hương Sen kết hợp hoàn mỹ giữa nguyên liệu đại dương tươi sống tuyển chọn trong ngày, bàn tay bếp trưởng tài hoa và trải nghiệm gọi món công nghệ số hiện đại.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/reserve"
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-sm shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 hover:-translate-y-1 group"
            >
              <CalendarCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Đặt Bàn Giữ Chỗ VIP</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/menu"
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-dark-900/80 hover:bg-dark-850 text-slate-200 border border-white/15 font-bold text-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40"
            >
              <Utensils className="w-5 h-5 text-amber-400" />
              <span>Khám Phá Thực Đơn</span>
            </Link>

            <Link
              to="/table/table-b01-token"
              className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-dark-850/80 hover:bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold text-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-glow-emerald"
            >
              <Sparkles className="w-4 h-4" />
              <span>Trải Nghiệm QR Bàn 01</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-14 pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="font-serif text-3xl font-black gold-gradient-text">15+</p>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Năm Phục Vụ</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-black gold-gradient-text">4.9 / 5</p>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">★ Đánh Giá Thực Khách</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-black gold-gradient-text">100%</p>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Hải Sản Tươi Sống</p>
            </div>
            <div>
              <p className="font-serif text-3xl font-black gold-gradient-text">&lt; 15 Phút</p>
              <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">SLA Ra Món Chuẩn</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ATMOSPHERIC VALUE PILLARS */}
      <section className="py-12 bg-dark-900 border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-3xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Vị Trí Trung Tâm Quận 1</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                123 Đường Nguyễn Huệ, Phường Bến Nghé. Có bãi đỗ xe ô tô và bảo vệ 24/7.
              </p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Phục Vụ Không Nghỉ</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                10:00 - 23:00 mỗi ngày, kể cả ngày Lễ & Tết. Tiệc tối ấm cúng cùng gia đình.
              </p>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white">Hotline Đặt Tiệc & Sự Kiện</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                090 123 4567 • Hỗ trợ trang trí tiệc sinh nhật, kỷ niệm, gala đoàn thể.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SIGNATURE DISHES SHOWCASE */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14">
          <div>
            <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] block mb-1">
              Tuyển Chọn Bếp Trưởng
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-black text-white">
              Món Ăn Nổi Bật Được Yêu Thích
            </h2>
          </div>
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 mt-4 md:mt-0 group"
          >
            <span>Xem toàn bộ 120+ món ăn</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredDishes.map((dish) => (
            <div
              key={dish.id}
              className="glass-card-hover rounded-3xl overflow-hidden flex flex-col justify-between group shadow-luxury"
            >
              <div>
                <div className="relative h-56 overflow-hidden bg-dark-900">
                  <img
                    src={dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                    alt={dish.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent opacity-80" />

                  {dish.discountedPrice && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                      Ưu Đãi Đặc Biệt
                    </span>
                  )}

                  <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-dark-950/80 backdrop-blur-md text-amber-300 text-[10px] font-bold border border-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    {dish.preparationTimeMinutes} phút
                  </span>
                </div>

                <div className="p-5">
                  <h3 className="font-serif font-bold text-base text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {dish.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed font-light">
                    {dish.description || 'Chế biến công phu với nguồn hải sản tươi ngon nhất.'}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-white/5 flex items-center justify-between mt-2">
                <div>
                  <span className="text-base font-black text-amber-400">
                    {(dish.discountedPrice || dish.price).toLocaleString('vi-VN')} đ
                  </span>
                  {dish.discountedPrice && (
                    <span className="block text-[11px] text-slate-500 line-through">
                      {dish.price.toLocaleString('vi-VN')} đ
                    </span>
                  )}
                </div>

                <Link
                  to="/menu"
                  className="p-2.5 rounded-2xl bg-amber-500/10 hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 text-amber-400 hover:text-white border border-amber-500/30 transition-all duration-300 shadow-md group-hover:scale-105"
                  title="Xem món"
                >
                  <Utensils className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. LUXURY AMBIENCE SPACES */}
      <section className="py-20 bg-dark-900 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Không Gian Ẩm Thực</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-black text-white mt-1">
              Đa Dạng Kiến Trúc Cho Mọi Dịp Hội Ngộ
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card rounded-3xl overflow-hidden group shadow-luxury">
              <div className="h-60 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80"
                  alt="Tầng Trệt"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">Tầng Trệt (Indoor)</span>
                <h3 className="font-serif text-lg font-bold text-white mt-1">Không Gian Ấm Cúng & Sang Trọng</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Phù hợp cho các bữa cơm gia đình thân mật và gặp gỡ bạn bè với hệ thống bàn ăn tiêu chuẩn cao cấp.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden group shadow-luxury">
              <div className="h-60 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=600&q=80"
                  alt="Phòng VIP"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">Tầng 1 (Private VIP)</span>
                <h3 className="font-serif text-lg font-bold text-white mt-1">Phòng VIP Riêng Tư Tiếp Đối Tác</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Cách âm tuyệt đối, nội thất hoàng gia, nhân viên phục vụ chuyên biệt cho các buổi ký kết hợp đồng.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden group shadow-luxury">
              <div className="h-60 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=600&q=80"
                  alt="Sân Thượng"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">Sân Thượng (Rooftop)</span>
                <h3 className="font-serif text-lg font-bold text-white mt-1">Gió Mát Ngắm Trọn Sài Gòn Về Đêm</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Không gian mở lãng mạn dưới ánh nến và quầy bar cocktail ngoài trời cho những buổi hẹn hò thăng hoa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="border-t border-white/10 bg-dark-950 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="font-serif font-bold text-white text-sm">HƯƠNG SEN RESTAURANT MANAGEMENT SYSTEM</span>
          </div>
          <p>© 2026 Hương Sen RMS. Đồ án Chuyên ngành Lập Trình Web.</p>
        </div>
      </footer>
    </div>
  );
};
