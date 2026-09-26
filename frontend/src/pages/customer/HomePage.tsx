import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Clock, 
  MapPin, 
  Phone, 
  Star, 
  CalendarCheck,
  Utensils,
  ChevronRight,
  Plus,
  Quote,
  CheckCircle2,
  Users
} from 'lucide-react';
import { api } from '../../services/api';
import { useCart } from '../../contexts/CartContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [featuredDishes, setFeaturedDishes] = useState<any[]>([]);
  const { addToCart } = useCart();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Quick reservation form state
  const [resData, setResData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '18:30',
    guests: 4,
    name: '',
    phone: '',
    notes: '',
  });
  const [resSuccess, setResSuccess] = useState(false);
  const [resLoading, setResLoading] = useState(false);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await api.get('/menu');
        const allDishes = res.data.flatMap((cat: any) => cat.dishes);
        // Signature items from different categories
        const signatures = allDishes
          .filter((d: any) => d.isBestSeller && d.isAvailable)
          .sort((a: any, b: any) => (b.soldCount || 0) - (a.soldCount || 0));
        setFeaturedDishes(signatures.length >= 4 ? signatures.slice(0, 4) : allDishes.slice(0, 4));
      } catch (e) {
        console.error('Lỗi tải món ăn nổi bật:', e);
      }
    }
    fetchFeatured();
  }, []);

  const handleQuickAdd = (dish: any) => {
    addToCart(dish, 1, [], '');
    setToastMsg(`Đã thêm "${dish.name}" vào giỏ hàng`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleQuickReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resData.name || !resData.phone) {
      alert('Vui lòng điền họ tên và số điện thoại liên hệ.');
      return;
    }
    setResLoading(true);
    try {
      await api.post('/reservations', {
        customerName: resData.name,
        customerPhone: resData.phone,
        reservationTime: `${resData.date}T${resData.time}:00.000Z`,
        guestCount: Number(resData.guests),
        specialRequest: resData.notes || 'Đặt bàn nhanh từ trang chủ',
      });
      setResSuccess(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi khi đặt bàn. Vui lòng thử lại.');
    } finally {
      setResLoading(false);
    }
  };

  // Authentic realistic reviews
  const authenticCustomerReviews = [
    {
      author: 'Nguyễn Minh Tuấn',
      rating: 5,
      date: 'Tháng 9, 2026',
      dish: 'Cá rô đồng kho tộ & Cơm niêu cháy giòn',
      text: 'Niêu cá rô kho đượm vị tiêu sọ thơm nức, xương cá mềm nhừ mà thịt vẫn săn chắc ngọt lịm. Cơm niêu có lớp cháy vàng giòn tan rụm chấm kho quẹt thì không chê vào đâu được.',
    },
    {
      author: 'Lê Thị Thu Hằng',
      rating: 4,
      date: 'Tháng 9, 2026',
      dish: 'Phở bò tái nạm gầu & Gỏi cuốn tôm thịt',
      text: 'Nước dùng phở bò trong veo, thơm nức mùi quế hồi thảo quả đúng chất phở truyền thống phố cổ. Giờ cao điểm khách hơi đông nên phải đợi chừng 15 phút, nhưng nhân viên phục vụ rất nhã nhặn.',
    },
    {
      author: 'Trần Văn Cường',
      rating: 5,
      date: 'Tháng 8, 2026',
      dish: 'Lẩu mắm miền Tây & Gà nướng mật ong',
      text: 'Nước lẩu mắm nấu rất khéo, thơm đậm mùi mắm cá sặc mà không bị gắt mặn. Rổ rau đồng tươi roi rói với hơn chục loại rau sông nước. Cả gia đình 6 người ăn ai cũng tấm tắc khen ngon.',
    },
  ];

  return (
    <div className="bg-[#FAF7F2] text-wood-900 min-h-screen">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-lotus-800 text-white px-5 py-3 rounded-soft shadow-lift text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <span>✓ {toastMsg}</span>
        </div>
      )}

      {/* ================= 1. HERO SECTION (EDITORIAL & AUTHENTIC) ================= */}
      <section className="relative min-h-[85vh] flex items-center py-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-[#241C15]">
        {/* Background authentic Vietnamese culinary photo */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 transition-transform duration-1000 scale-100"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1544025162-d76694265947?w=1920&q=85')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#18130E] via-[#241C15]/85 to-transparent" />

        <div className="relative max-w-7xl mx-auto w-full z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 text-left space-y-6">
            
            <div className="inline-flex items-center gap-3">
              <span className="w-8 h-0.5 bg-lotus-300" />
              <span className="text-xs uppercase tracking-[0.3em] font-semibold text-lotus-200">
                Ẩm Thực Thuần Việt
              </span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold text-[#FDFBF7] tracking-tight leading-[1.15]">
              HƯƠNG SEN
            </h1>

            <p className="font-serif italic text-2xl sm:text-3xl text-lotus-200/95 font-normal">
              “Trọn vị Việt, gìn giữ hương quê.”
            </p>

            <p className="text-sm sm:text-base text-cream-200/90 max-w-2xl font-light leading-relaxed">
              Từ ngọn lửa đượm than hồng, niêu đất mộc mạc đến hạt gạo thơm ST25 và con tôm, con cá mùa nước nổi. Chúng tôi gom góp những tinh hoa bình dị của mâm cơm mẹ nấu để gửi gắm trọn vẹn tình thân nơi phố thị.
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link
                to="/menu"
                className="px-8 py-3.5 rounded-soft bg-lotus-800 text-white hover:bg-lotus-700 transition-colors font-semibold text-xs tracking-wider uppercase shadow-subtle flex items-center gap-2 group"
              >
                <span>Xem Thực Đơn</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/reserve"
                className="px-8 py-3.5 rounded-soft border border-cream-200/30 text-cream-100 hover:border-cream-100 hover:bg-white/5 transition-colors font-semibold text-xs tracking-wider uppercase"
              >
                Đặt Bàn Trước
              </Link>
            </div>

          </div>

          {/* Quick Info Box on Hero */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-[#1D1712]/90 border border-white/10 rounded-soft p-6 text-cream-100 space-y-4 backdrop-blur-sm">
              <span className="text-[11px] uppercase tracking-widest text-lotus-300 font-semibold block">
                Thông Tin Phục Vụ
              </span>
              <div className="space-y-3 text-xs text-cream-200/80">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-lotus-300 shrink-0 mt-0.5" />
                  <span>123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP. HCM</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-lotus-300 shrink-0" />
                  <span>10:00 - 22:30 hàng ngày</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-lotus-300 shrink-0" />
                  <span>Hotline: 0901.234.567</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= 2. MÓN NGON HÔM NAY (EDITORIAL ASYMMETRIC) ================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12 pb-4 border-b border-wood-900/10">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-lotus-800 font-semibold block mb-2">
              Gợi Ý Từ Bếp Trưởng
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-wood-950">
              Món Ngon Hôm Nay
            </h2>
          </div>
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 text-xs font-bold text-lotus-800 hover:text-lotus-900 tracking-wider uppercase group"
          >
            <span>Xem Toàn Bộ 118 Món Việt</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Asymmetric Editorial Grid: 1 large feature on left, 3 stacked on right */}
        {featuredDishes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* 1. Large Feature Card (Left - 7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-soft border border-wood-900/10 shadow-subtle overflow-hidden flex flex-col group">
              <div className="relative h-80 sm:h-96 overflow-hidden">
                <img
                  src={featuredDishes[0]?.imageUrl}
                  alt={featuredDishes[0]?.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute top-4 left-4 bg-lotus-800 text-white text-[11px] uppercase tracking-wider font-semibold px-3 py-1 rounded-soft">
                  Món Đặc Trưng
                </span>
                <span className="absolute bottom-4 right-4 bg-wood-950/80 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-soft">
                  {featuredDishes[0]?.price?.toLocaleString('vi-VN')} đ
                </span>
              </div>
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-wood-950 mb-2">
                    {featuredDishes[0]?.name}
                  </h3>
                  <p className="text-sm text-wood-700 leading-relaxed font-light line-clamp-3">
                    {featuredDishes[0]?.description || featuredDishes[0]?.shortDescription}
                  </p>
                </div>
                <div className="pt-4 border-t border-wood-900/10 flex items-center justify-between">
                  <div className="text-xs text-wood-600 flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span className="font-semibold text-wood-900">{featuredDishes[0]?.rating || 4.9}</span>
                    <span>({featuredDishes[0]?.reviewCount || 120} đánh giá)</span>
                  </div>
                  <button
                    onClick={() => handleQuickAdd(featuredDishes[0])}
                    className="px-5 py-2.5 rounded-soft bg-lotus-800 hover:bg-lotus-700 text-white text-xs font-semibold tracking-wider uppercase transition-colors"
                  >
                    Thêm Vào Giỏ
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Stacked Smaller Cards (Right - 5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-6">
              {featuredDishes.slice(1, 4).map((dish) => (
                <div 
                  key={dish.id}
                  className="bg-white rounded-soft border border-wood-900/10 shadow-subtle p-4 flex gap-4 items-center group hover:border-lotus-800/30 transition-colors"
                >
                  <div className="w-28 h-28 shrink-0 rounded-soft overflow-hidden bg-cream-200">
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="font-serif text-base font-bold text-wood-950 truncate group-hover:text-lotus-800 transition-colors">
                      {dish.name}
                    </h4>
                    <p className="text-xs text-wood-600 line-clamp-2 font-light">
                      {dish.shortDescription}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold text-lotus-900 font-serif">
                        {dish.price?.toLocaleString('vi-VN')} đ
                      </span>
                      <button
                        onClick={() => handleQuickAdd(dish)}
                        className="p-1.5 rounded-soft border border-wood-900/20 text-wood-700 hover:bg-lotus-800 hover:text-white hover:border-lotus-800 transition-colors"
                        title="Thêm nhanh vào giỏ"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </section>

      {/* ================= 3. SECTION VÙNG MIỀN (BẮC - TRUNG - NAM) ================= */}
      <section className="py-20 bg-cream-200/60 border-y border-wood-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs uppercase tracking-[0.3em] text-lotus-800 font-semibold block">
              Dấu Ấn Ẩm Thực Ba Miền
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-wood-950">
              Hành Trình Vị Giác Đất Việt
            </h2>
            <p className="text-sm text-wood-700 font-light">
              Mỗi vùng miền là một nét tính cách, một câu chuyện văn hóa được chắt lọc qua bàn tay của những người đầu bếp tâm huyết.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Miền Bắc */}
            <div className="bg-white rounded-soft border border-wood-900/10 p-6 flex flex-col justify-between space-y-6 shadow-subtle">
              <div className="space-y-4">
                <div className="h-48 rounded-soft overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&q=80"
                    alt="Ẩm thực miền Bắc"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-lotus-800 font-bold block mb-1">
                    Thanh Vị • Tinh Tế
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-wood-950">
                    MIỀN BẮC
                  </h3>
                </div>
                <p className="text-xs text-wood-700 font-light leading-relaxed">
                  Chú trọng sự cân bằng thanh đạm, vị vừa vặn không quá cay nồng cũng không quá ngọt. Nước dùng trong veo ninh từ xương hầm thơm quế hồi, tiêu cay ấm.
                </p>
              </div>
              <div className="pt-4 border-t border-wood-900/10">
                <p className="text-[11px] text-wood-500 uppercase tracking-wider font-semibold mb-1">Món tiêu biểu:</p>
                <p className="text-xs font-serif italic text-wood-800">
                  Phở bò tái nạm gầu, Bún chả than hoa, Chả cá thác lác thì là
                </p>
              </div>
            </div>

            {/* Miền Trung */}
            <div className="bg-white rounded-soft border border-wood-900/10 p-6 flex flex-col justify-between space-y-6 shadow-subtle">
              <div className="space-y-4">
                <div className="h-48 rounded-soft overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1576577445504-6af96477db52?w=600&q=80"
                    alt="Ẩm thực miền Trung"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-lotus-800 font-bold block mb-1">
                    Đậm Đà • Cay Nồng
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-wood-950">
                    MIỀN TRUNG
                  </h3>
                </div>
                <p className="text-xs text-wood-700 font-light leading-relaxed">
                  Đượm vị mặn mòi của biển khơi và vị cay the nồng nàn của ớt hiểm, sả ruốc. Những món kho tộ keo quánh đậm đà ăn kèm rau sống quê nhà.
                </p>
              </div>
              <div className="pt-4 border-t border-wood-900/10">
                <p className="text-[11px] text-wood-500 uppercase tracking-wider font-semibold mb-1">Món tiêu biểu:</p>
                <p className="text-xs font-serif italic text-wood-800">
                  Bún bò Huế chả cua, Nem nướng than hoa, Cá bống sông Trà kho tiêu
                </p>
              </div>
            </div>

            {/* Miền Nam */}
            <div className="bg-white rounded-soft border border-wood-900/10 p-6 flex flex-col justify-between space-y-6 shadow-subtle">
              <div className="space-y-4">
                <div className="h-48 rounded-soft overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80"
                    alt="Ẩm thực miền Nam"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-lotus-800 font-bold block mb-1">
                    Ngọt Dịu • Phóng Khoáng
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-wood-950">
                    MIỀN NAM
                  </h3>
                </div>
                <p className="text-xs text-wood-700 font-light leading-relaxed">
                  Trù phú sản vật sông nước đồng bằng. Hương vị ngòn ngọt béo bùi từ nước cốt dừa, hoa điên điển, cá kèo và đĩa rau rừng tươi mát.
                </p>
              </div>
              <div className="pt-4 border-t border-wood-900/10">
                <p className="text-[11px] text-wood-500 uppercase tracking-wider font-semibold mb-1">Món tiêu biểu:</p>
                <p className="text-xs font-serif italic text-wood-800">
                  Cơm tấm sườn bì chả, Canh chua cá lóc điên điển, Lẩu mắm miền Tây
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ================= 4. CÂU CHUYỆN HƯƠNG SEN (STORYTELLING) ================= */}
      <section id="story" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Collage Imagery of Kitchen & Ingredients */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-soft overflow-hidden h-56 shadow-subtle">
                <img
                  src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80"
                  alt="Không gian bếp mộc"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="rounded-soft overflow-hidden h-40 shadow-subtle">
                <img
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80"
                  alt="Nguyên liệu tươi"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="rounded-soft overflow-hidden h-44 shadow-subtle">
                <img
                  src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80"
                  alt="Trà sen ấm áp"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="rounded-soft overflow-hidden h-52 shadow-subtle">
                <img
                  src="https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=80"
                  alt="Người đầu bếp chuẩn bị món"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* Narrative Content */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs uppercase tracking-[0.25em] text-lotus-800 font-semibold block">
              Gìn Giữ Bản Sắc
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-wood-950 leading-tight">
              Câu Chuyện Hương Sen
            </h2>
            <div className="space-y-4 text-sm text-wood-700 font-light leading-relaxed">
              <p>
                Hương Sen bắt đầu từ ký ức về căn bếp ấm lửa của bà và mẹ những chiều mưa: khói củi vương nhẹ trên mái ngói, niêu cá bống kho tiêu sôi lục bục trên bếp than, và mùi thơm dịu của mẻ cơm mới nấu bằng gạo tám thơm.
              </p>
              <p>
                Giữa nhịp sống vội vã, chúng tôi mong muốn giữ gìn một chốn dừng chân bình yên, nơi thực khách có thể tìm lại hương vị quen thuộc của quê nhà. Từng hạt gạo ST25, con tôm đất, mớ rau rừng cho đến chén nước mắm nhĩ Phú Quốc đều được chọn lọc kỹ lưỡng từ các làng nghề truyền thống.
              </p>
              <p>
                Không cầu kỳ xa hoa, Hương Sen trân trọng sự chân thành trong từng cách nêm nếm, để mỗi bữa ăn không chỉ ngon miệng mà còn là sự gắn kết ấm áp của tình thân gia đình.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border border-lotus-800/30 flex items-center justify-center font-serif text-lg font-bold text-lotus-800">
                HS
              </div>
              <div>
                <p className="text-xs font-bold text-wood-900 uppercase tracking-wider">Đội Ngũ Bếp Hương Sen</p>
                <p className="text-[11px] text-wood-500 italic">Tâm huyết với ẩm thực truyền thống Việt</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= 5. KHÔNG GIAN NHÀ HÀNG (AMBIENCE GALLERY) ================= */}
      <section className="py-20 bg-cream-200/50 border-y border-wood-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <span className="text-xs uppercase tracking-[0.25em] text-lotus-800 font-semibold block">
              Không Gian Thư Thái
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-wood-950">
              Nét Mộc Mạc Giữa Lòng Đô Thị
            </h2>
            <p className="text-xs sm:text-sm text-wood-600 font-light">
              Nội thất gỗ trầm ấm cúng, ánh sáng tự nhiên và tiếng nước róc rách mang lại sự thư thái trọn vẹn cho bữa ăn của bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white rounded-soft border border-wood-900/10 overflow-hidden shadow-subtle group">
              <div className="h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80"
                  alt="Sảnh chính mộc mạc"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-base font-bold text-wood-950">Sảnh Chính Mộc Mạc</h3>
                <p className="text-xs text-wood-600 font-light mt-1">Bàn ghế gỗ mộc tự nhiên, không gian thoáng đãng cho bữa cơm gia đình.</p>
              </div>
            </div>

            <div className="bg-white rounded-soft border border-wood-900/10 overflow-hidden shadow-subtle group">
              <div className="h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80"
                  alt="Hiên sân vườn thoáng mát"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-base font-bold text-wood-950">Hiên Sân Vườn</h3>
                <p className="text-xs text-wood-600 font-light mt-1">Gió mát tự nhiên bên hàng tre ngà và hồ hoa súng xanh mát.</p>
              </div>
            </div>

            <div className="bg-white rounded-soft border border-wood-900/10 overflow-hidden shadow-subtle group">
              <div className="h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80"
                  alt="Phòng riêng VIP"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-base font-bold text-wood-950">Phòng Riêng Ấm Cúng</h3>
                <p className="text-xs text-wood-600 font-light mt-1">Không gian riêng tư, trang nhã dành cho gặp gỡ đối tác và tiệc sum vầy.</p>
              </div>
            </div>

            <div className="bg-white rounded-soft border border-wood-900/10 overflow-hidden shadow-subtle group">
              <div className="h-56 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80"
                  alt="Bếp mở truyền thống"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-base font-bold text-wood-950">Góc Bếp Mở</h3>
                <p className="text-xs text-wood-600 font-light mt-1">Khách có thể ngắm nhìn ngọn lửa reo vui và từng mẻ bánh xèo giòn rụm.</p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ================= 6. REVIEW THỰC KHÁCH THẬT ================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <span className="text-xs uppercase tracking-[0.25em] text-lotus-800 font-semibold block">
            Cảm Nhận Thực Khách
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-wood-950">
            Hương Vị Trong Lòng Người Yêu Ẩm Thực
          </h2>
          <p className="text-[11px] text-wood-500 italic">
            [Dữ liệu mẫu / Demo – Phản ánh trung thực khẩu vị và trải nghiệm phục vụ]
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {authenticCustomerReviews.map((rev, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-soft border border-wood-900/10 p-6 flex flex-col justify-between space-y-4 shadow-subtle"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-500' : 'text-wood-200'}`} 
                    />
                  ))}
                </div>
                <p className="text-xs text-wood-700 font-light leading-relaxed">
                  "{rev.text}"
                </p>
              </div>
              <div className="pt-4 border-t border-wood-900/10 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-wood-900">{rev.author}</p>
                  <p className="text-[10px] text-wood-500">{rev.dish}</p>
                </div>
                <span className="text-[10px] text-wood-400">{rev.date}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 7. ĐẶT BÀN NHANH (RESERVATION FORM) ================= */}
      <section className="py-20 bg-lotus-900 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center space-y-3 mb-10">
            <span className="text-xs uppercase tracking-[0.25em] text-lotus-300 font-semibold block">
              Giữ Chỗ Trước
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-cream-100">
              Đặt Bàn Tại Hương Sen
            </h2>
            <p className="text-xs sm:text-sm text-lotus-200/80 font-light max-w-xl mx-auto">
              Để chúng tôi chuẩn bị chu đáo nhất cho bữa tiệc sum họp của quý khách, xin vui lòng đặt bàn trước ít nhất 1 giờ.
            </p>
          </div>

          {resSuccess ? (
            <div className="bg-white/10 backdrop-blur-md rounded-soft p-8 text-center border border-white/20 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-lotus-300 mx-auto" />
              <h3 className="font-serif text-2xl font-bold text-white">Yêu Cầu Đặt Bàn Đã Được Ghi Nhận!</h3>
              <p className="text-xs text-cream-200/90 max-w-md mx-auto">
                Nhà hàng Hương Sen sẽ liên hệ với quý khách qua số điện thoại <span className="font-bold text-white">{resData.phone}</span> để xác nhận trong vòng 10 phút.
              </p>
              <button
                onClick={() => setResSuccess(false)}
                className="mt-4 px-6 py-2 rounded-soft bg-white text-lotus-900 text-xs font-bold uppercase tracking-wider hover:bg-cream-100 transition-colors"
              >
                Đặt Thêm Bàn Khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleQuickReserve} className="bg-white/10 backdrop-blur-md rounded-soft p-6 sm:p-8 border border-white/15 space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-cream-200 mb-1.5">Ngày Dùng Bữa</label>
                  <input
                    type="date"
                    required
                    value={resData.date}
                    onChange={(e) => setResData({ ...resData, date: e.target.value })}
                    className="w-full bg-[#182B22] border border-white/20 rounded-soft px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-lotus-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-cream-200 mb-1.5">Khung Giờ</label>
                  <select
                    value={resData.time}
                    onChange={(e) => setResData({ ...resData, time: e.target.value })}
                    className="w-full bg-[#182B22] border border-white/20 rounded-soft px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-lotus-400"
                  >
                    <option value="11:30">11:30 (Trưa)</option>
                    <option value="12:00">12:00 (Trưa)</option>
                    <option value="12:30">12:30 (Trưa)</option>
                    <option value="18:00">18:00 (Tối)</option>
                    <option value="18:30">18:30 (Tối)</option>
                    <option value="19:00">19:00 (Tối)</option>
                    <option value="19:30">19:30 (Tối)</option>
                    <option value="20:00">20:00 (Tối)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-cream-200 mb-1.5">Số Lượng Thực Khách</label>
                  <select
                    value={resData.guests}
                    onChange={(e) => setResData({ ...resData, guests: Number(e.target.value) })}
                    className="w-full bg-[#182B22] border border-white/20 rounded-soft px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-lotus-400"
                  >
                    <option value={2}>2 Người (Bàn đôi)</option>
                    <option value={4}>4 Người (Tiêu chuẩn)</option>
                    <option value={6}>6 Người (Gia đình)</option>
                    <option value={8}>8 Người (Đoàn nhỏ)</option>
                    <option value={12}>12+ Người (Phòng riêng VIP)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-cream-200 mb-1.5">Họ Và Tên</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={resData.name}
                    onChange={(e) => setResData({ ...resData, name: e.target.value })}
                    className="w-full bg-[#182B22] border border-white/20 rounded-soft px-3.5 py-2.5 text-xs text-white placeholder:text-cream-300/40 focus:outline-none focus:border-lotus-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-cream-200 mb-1.5">Số Điện Thoại</label>
                  <input
                    type="tel"
                    required
                    placeholder="09xx xxx xxx"
                    value={resData.phone}
                    onChange={(e) => setResData({ ...resData, phone: e.target.value })}
                    className="w-full bg-[#182B22] border border-white/20 rounded-soft px-3.5 py-2.5 text-xs text-white placeholder:text-cream-300/40 focus:outline-none focus:border-lotus-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-cream-200 mb-1.5">Ghi Chú Đặc Biệt (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tiệc sinh nhật, bàn gần cửa sổ, ghế trẻ em..."
                  value={resData.notes}
                  onChange={(e) => setResData({ ...resData, notes: e.target.value })}
                  className="w-full bg-[#182B22] border border-white/20 rounded-soft px-3.5 py-2.5 text-xs text-white placeholder:text-cream-300/40 focus:outline-none focus:border-lotus-400"
                />
              </div>

              <button
                type="submit"
                disabled={resLoading}
                className="w-full py-3.5 rounded-soft bg-white text-lotus-900 hover:bg-cream-100 transition-colors font-bold text-xs uppercase tracking-widest shadow-subtle disabled:opacity-50"
              >
                {resLoading ? 'Đang Gửi Yêu Cầu...' : 'XÁC NHẬN ĐẶT BÀN'}
              </button>

            </form>
          )}

        </div>
      </section>

      {/* ================= 8. FOOTER ================= */}
      <footer id="contact" className="bg-[#1E1710] text-cream-200 pt-16 pb-12 border-t border-wood-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            
            {/* Col 1: Brand Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-soft bg-lotus-800 text-white flex items-center justify-center font-serif font-bold text-sm">
                  S
                </div>
                <span className="font-serif text-xl font-bold text-white tracking-wider">HƯƠNG SEN</span>
              </div>
              <p className="text-xs text-cream-300/80 font-light leading-relaxed">
                Món Việt trong một không gian hiện đại, lưu giữ trọn vẹn hương vị tinh túy của bữa cơm quê nhà.
              </p>
              <div className="text-xs text-cream-300/70 space-y-1">
                <p>Hotline: 0901.234.567</p>
                <p>Email: lienhe@huongsen.vn</p>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Khám Phá</p>
              <ul className="space-y-2 text-xs text-cream-300/70 font-light">
                <li><Link to="/menu" className="hover:text-white transition-colors">Thực Đơn 118 Món Việt</Link></li>
                <li><Link to="/reserve" className="hover:text-white transition-colors">Đặt Bàn Trước</Link></li>
                <li><Link to="/order-lookup" className="hover:text-white transition-colors">Tra Cứu Đơn Hàng</Link></li>
                <li><Link to="/table/table-b01-token" className="hover:text-white transition-colors">Gọi Món Tại Bàn (QR Code)</Link></li>
              </ul>
            </div>

            {/* Col 3: Operating Hours */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Giờ Phục Vụ</p>
              <div className="space-y-2 text-xs text-cream-300/70 font-light">
                <p><span className="font-semibold text-cream-200">Thứ Hai - Chủ Nhật:</span><br />10:00 - 22:30</p>
                <p><span className="font-semibold text-cream-200">Bếp nhận order cuối:</span><br />21:45 mỗi ngày</p>
              </div>
            </div>

            {/* Col 4: Location */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-white">Chi Nhánh Trung Tâm</p>
              <p className="text-xs text-cream-300/70 font-light leading-relaxed">
                123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
              </p>
              <div className="pt-2">
                <Link
                  to="/reserve"
                  className="inline-block px-4 py-2 rounded-soft border border-lotus-400 text-lotus-300 text-xs font-semibold hover:bg-lotus-900 transition-colors"
                >
                  Đặt Bàn Ngay
                </Link>
              </div>
            </div>

          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-cream-300/50 gap-4">
            <p>© 2026 Nhà Hàng Hương Sen. Bảo lưu mọi quyền.</p>
            <p className="font-light">Thiết kế chuẩn thương hiệu ẩm thực Việt Nam.</p>
          </div>
        </div>
      </footer>

    </div>
  );
};
