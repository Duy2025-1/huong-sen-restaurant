import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  X,
  Clock,
  ShoppingBag,
  Check,
  Sparkles,
  Flame,
  Tag,
  Star,
  Filter,
  RotateCcw,
  ChevronRight,
  Info,
  AlertCircle,
  ThumbsUp,
  MessageSquare,
  Send,
  Eye,
  Utensils
} from 'lucide-react';
import { api } from '../../services/api';
import { useCart } from '../../contexts/CartContext';

interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface Review {
  id: number;
  userName: string;
  avatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
}

interface ModifierItem {
  id: number;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
}

interface ModifierGroup {
  id: number;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  items: ModifierItem[];
}

interface Dish {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  price: number;
  originalPrice?: number;
  discountedPrice?: number;
  discount?: number;
  imageUrl?: string;
  gallery?: string | string[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  isAvailable: boolean;
  isBestSeller: boolean;
  isNew: boolean;
  isPopular: boolean;
  preparationTimeMinutes: number;
  servingSize?: string;
  calories?: number;
  spicyLevel?: string;
  ingredients?: string | string[];
  allergens?: string | string[];
  nutrition?: string | NutritionInfo;
  tags?: string | string[];
  category?: { id: number; name: string; slug: string };
  modifierGroups?: Array<{ modifierGroup: ModifierGroup }>;
  reviews?: Review[];
  relatedDishes?: Dish[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string;
  dishes: Dish[];
}

const safeParseJson = <T,>(val: any, fallback: T): T => {
  if (!val) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

export const MenuPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Filters & Sorting state
  const [selectedSpicy, setSelectedSpicy] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'bestseller' | 'popular' | 'new' | 'discount'>('all');
  const [sortBy, setSortBy] = useState<string>('popular');

  // Cart
  const { addToCart, setIsCartOpen } = useCart();

  // Detail Modal state
  const [detailDish, setDetailDish] = useState<Dish | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [modalTab, setModalTab] = useState<'customize' | 'reviews'>('customize');
  const [modalModifiers, setModalModifiers] = useState<number[]>([]);
  const [modalNote, setModalNote] = useState('');
  const [modalQty, setModalQty] = useState(1);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Review submission state inside modal
  const [newReviewerName, setNewReviewerName] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  // Toast
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // 1. Fetch initial categories and dishes
  useEffect(() => {
    async function fetchMenu() {
      try {
        setLoading(true);
        const res = await api.get('/menu');
        setCategories(res.data);
      } catch (err) {
        console.error('Error loading menu:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, []);

  const allDishes = useMemo(() => {
    return categories.flatMap((c) => c.dishes);
  }, [categories]);

  // Filtered and sorted dishes
  const filteredDishes = useMemo(() => {
    return allDishes
      .filter((dish) => {
        // Category filter
        if (selectedCatId !== 'all' && dish.categoryId !== selectedCatId) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = dish.name.toLowerCase().includes(q);
          const descMatch = (dish.description || '').toLowerCase().includes(q);
          const shortDescMatch = (dish.shortDescription || '').toLowerCase().includes(q);
          const ingredientsStr = typeof dish.ingredients === 'string' ? dish.ingredients : JSON.stringify(dish.ingredients || []);
          const ingMatch = ingredientsStr.toLowerCase().includes(q);
          const tagsStr = typeof dish.tags === 'string' ? dish.tags : JSON.stringify(dish.tags || []);
          const tagMatch = tagsStr.toLowerCase().includes(q);

          if (!nameMatch && !descMatch && !shortDescMatch && !ingMatch && !tagMatch) {
            return false;
          }
        }

        // Spicy filter
        if (selectedSpicy !== 'all' && dish.spicyLevel !== selectedSpicy) {
          return false;
        }

        // Price range filter
        const price = dish.discountedPrice || dish.price;
        if (selectedPriceRange === 'under50' && price >= 50000) return false;
        if (selectedPriceRange === '50to100' && (price < 50000 || price > 100000)) return false;
        if (selectedPriceRange === '100to200' && (price < 100000 || price > 200000)) return false;
        if (selectedPriceRange === 'above200' && price <= 200000) return false;

        // Quick filter
        if (quickFilter === 'bestseller' && !dish.isBestSeller) return false;
        if (quickFilter === 'popular' && !dish.isPopular) return false;
        if (quickFilter === 'new' && !dish.isNew) return false;
        if (quickFilter === 'discount' && !(dish.discount && dish.discount > 0)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.rating - a.rating;
        if (sortBy === 'bestseller') return (b.soldCount || 0) - (a.soldCount || 0);
        if (sortBy === 'price_asc') return (a.discountedPrice || a.price) - (b.discountedPrice || b.price);
        if (sortBy === 'price_desc') return (b.discountedPrice || b.price) - (a.discountedPrice || a.price);
        if (sortBy === 'newest') return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
        // Default: popular
        return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0) || (b.soldCount || 0) - (a.soldCount || 0);
      });
  }, [allDishes, selectedCatId, searchQuery, selectedSpicy, selectedPriceRange, quickFilter, sortBy]);

  // Open detail modal with full reviews & related products
  const handleOpenDetail = async (dish: Dish) => {
    try {
      setLoadingDetail(true);
      setActiveImageIdx(0);
      setModalTab('customize');
      setModalNote('');
      setModalQty(1);
      setReviewMsg(null);

      // Pre-select required modifiers
      const preselected: number[] = [];
      dish.modifierGroups?.forEach((mg) => {
        if (mg.modifierGroup.isRequired && mg.modifierGroup.items?.length > 0) {
          preselected.push(mg.modifierGroup.items[0].id);
        }
      });
      setModalModifiers(preselected);
      setDetailDish(dish);

      // Fetch fresh detail with reviews and related dishes
      const res = await api.get(`/menu/dish/${dish.id}`);
      if (res.data) {
        setDetailDish(res.data);
      }
    } catch (err) {
      console.error('Error fetching dish details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Quick add to cart
  const handleQuickAdd = (e: React.MouseEvent, dish: Dish) => {
    e.stopPropagation();
    if (dish.modifierGroups && dish.modifierGroups.length > 0) {
      handleOpenDetail(dish);
    } else {
      addToCart(dish, 1, [], '');
      showToast(`Đã thêm "${dish.name}" vào giỏ hàng!`);
    }
  };

  // Add from Detail modal
  const handleModalAddToCart = () => {
    if (!detailDish) return;

    const chosenMods: ModifierItem[] = [];
    detailDish.modifierGroups?.forEach((mg) => {
      mg.modifierGroup.items?.forEach((item) => {
        if (modalModifiers.includes(item.id)) {
          chosenMods.push(item);
        }
      });
    });

    addToCart(detailDish, modalQty, chosenMods, modalNote);
    showToast(`Đã thêm ${modalQty} phần "${detailDish.name}" vào giỏ hàng!`);
    setDetailDish(null);
  };

  // Submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailDish) return;
    if (!newReviewerName.trim()) {
      alert('Vui lòng nhập tên của bạn.');
      return;
    }
    if (!newReviewComment.trim()) {
      alert('Vui lòng viết lời nhận xét của bạn.');
      return;
    }

    try {
      setSubmittingReview(true);
      const res = await api.post(`/menu/dish/${detailDish.id}/reviews`, {
        userName: newReviewerName,
        rating: newReviewRating,
        comment: newReviewComment,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
      });

      setReviewMsg('Cảm ơn bạn! Đánh giá đã được ghi nhận.');
      setNewReviewComment('');

      // Refresh reviews list inside modal
      const updatedDishRes = await api.get(`/menu/dish/${detailDish.id}`);
      setDetailDish(updatedDishRes.data);

      // Also update local dish in categories list
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          dishes: cat.dishes.map((d) =>
            d.id === detailDish.id
              ? { ...d, rating: res.data.newRating, reviewCount: res.data.newReviewCount }
              : d
          ),
        }))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi gửi đánh giá.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const showToast = (msg: string) => {
    setAddedToast(msg);
    setTimeout(() => setAddedToast(null), 3500);
  };

  const resetFilters = () => {
    setSelectedCatId('all');
    setSearchQuery('');
    setSelectedSpicy('all');
    setSelectedPriceRange('all');
    setQuickFilter('all');
    setSortBy('popular');
  };

  const isAnyFilterActive =
    selectedCatId !== 'all' ||
    searchQuery.trim() !== '' ||
    selectedSpicy !== 'all' ||
    selectedPriceRange !== 'all' ||
    quickFilter !== 'all' ||
    sortBy !== 'popular';

  // Compute live price inside modal
  const modalTotalPrice = useMemo(() => {
    if (!detailDish) return 0;
    const base = detailDish.discountedPrice || detailDish.price;
    let extra = 0;
    detailDish.modifierGroups?.forEach((mg) => {
      mg.modifierGroup.items?.forEach((item) => {
        if (modalModifiers.includes(item.id)) {
          extra += item.additionalPrice || 0;
        }
      });
    });
    return (base + extra) * modalQty;
  }, [detailDish, modalModifiers, modalQty]);

  return (
    <div className="min-h-screen bg-dark-950 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-slate-100">
      {/* Toast Alert */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-dark-900/95 backdrop-blur-xl text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-amber-500/30 animate-in slide-in-from-bottom duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-100">{addedToast}</p>
            <p className="text-[10px] text-slate-400">Kiểm tra giỏ hàng để hoàn tất đặt món</p>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="ml-3 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-[11px] font-black hover:opacity-90 shadow-md shadow-orange-500/20"
          >
            Mở giỏ hàng
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 pb-8 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thực Đơn Đẳng Cấp 5 Sao</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ẩm Thực Nhà Hàng Hương Sen
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-light max-w-2xl">
            Tuyển tập hơn 150 món ăn thượng hạng từ món khai vị, steak bò Úc, hải sản tươi sống, pizza nướng củi, cho đến các set combo tiết kiệm, đồ uống thanh nhiệt và tráng miệng tinh tế.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Tìm theo tên món, nguyên liệu, hương vị..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-900 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-500 shadow-inner focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 15 Categories Horizontal Scrollbar */}
      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none">
          <button
            onClick={() => setSelectedCatId('all')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
              selectedCatId === 'all'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-dark-900 text-slate-400 hover:text-white hover:bg-dark-850 border border-white/5'
            }`}
          >
            <span>Tất Cả</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-black">
              {allDishes.length}
            </span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                selectedCatId === cat.id
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-dark-900 text-slate-400 hover:text-white hover:bg-dark-850 border border-white/5'
              }`}
            >
              <span>{cat.name}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 font-black">
                {cat.dishes.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Filter & Sort Toolbar */}
      <div className="bg-dark-900/60 border border-white/5 rounded-3xl p-4 mb-8 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            Lọc nhanh:
          </span>

          <button
            onClick={() => setQuickFilter(quickFilter === 'bestseller' ? 'all' : 'bestseller')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              quickFilter === 'bestseller'
                ? 'bg-amber-500 text-white'
                : 'bg-dark-850 text-slate-300 hover:bg-dark-800 border border-white/5'
            }`}
          >
            🔥 Bán chạy
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'popular' ? 'all' : 'popular')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              quickFilter === 'popular'
                ? 'bg-orange-500 text-white'
                : 'bg-dark-850 text-slate-300 hover:bg-dark-800 border border-white/5'
            }`}
          >
            ⭐ Phổ biến
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'new' ? 'all' : 'new')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              quickFilter === 'new'
                ? 'bg-emerald-600 text-white'
                : 'bg-dark-850 text-slate-300 hover:bg-dark-800 border border-white/5'
            }`}
          >
            ✨ Món mới
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'discount' ? 'all' : 'discount')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              quickFilter === 'discount'
                ? 'bg-rose-600 text-white'
                : 'bg-dark-850 text-slate-300 hover:bg-dark-800 border border-white/5'
            }`}
          >
            🏷️ Khuyến mãi
          </button>
        </div>

        {/* Dropdown Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Spicy Level */}
          <select
            value={selectedSpicy}
            onChange={(e) => setSelectedSpicy(e.target.value)}
            className="bg-dark-850 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">Độ cay: Tất cả</option>
            <option value="NONE">Không cay</option>
            <option value="MILD">Cay nhẹ 🌶️</option>
            <option value="MEDIUM">Cay vừa 🌶️🌶️</option>
            <option value="HOT">Cay nồng 🌶️🌶️🌶️</option>
          </select>

          {/* Price Range */}
          <select
            value={selectedPriceRange}
            onChange={(e) => setSelectedPriceRange(e.target.value)}
            className="bg-dark-850 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">Mức giá: Tất cả</option>
            <option value="under50">Dưới 50.000 đ</option>
            <option value="50to100">50.000 đ - 100.000 đ</option>
            <option value="100to200">100.000 đ - 200.000 đ</option>
            <option value="above200">Trên 200.000 đ</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-dark-850 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500/50"
          >
            <option value="popular">Sắp xếp: Phổ biến nhất</option>
            <option value="rating">Đánh giá cao nhất (4.8+)</option>
            <option value="bestseller">Bán chạy nhất</option>
            <option value="price_asc">Giá: Thấp đến Cao</option>
            <option value="price_desc">Giá: Cao đến Thấp</option>
            <option value="newest">Món mới ra mắt</option>
          </select>

          {/* Reset Filters */}
          {isAnyFilterActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-slate-400">
          Hiển thị <span className="text-amber-400 font-bold">{filteredDishes.length}</span> món ăn
          {selectedCatId !== 'all' && categories.find((c) => c.id === selectedCatId) && (
            <span> trong danh mục <strong className="text-slate-200">{categories.find((c) => c.id === selectedCatId)?.name}</strong></span>
          )}
        </p>
      </div>

      {/* Dishes Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400 font-medium">Đang chuẩn bị thực đơn hảo hạng...</p>
        </div>
      ) : filteredDishes.length === 0 ? (
        <div className="py-24 text-center bg-dark-900/40 rounded-3xl border border-white/5 p-8">
          <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">Không tìm thấy món ăn phù hợp</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Đặt lại" để xem toàn bộ danh mục thực đơn.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-md"
          >
            Xem Tất Cả Món Ăn
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDishes.map((dish) => {
            const hasDiscount = dish.discount && dish.discount > 0;
            const currentPrice = dish.discountedPrice || dish.price;
            const originalPrice = dish.originalPrice || dish.price;
            const tags = safeParseJson<string[]>(dish.tags, []);

            return (
              <div
                key={dish.id}
                onClick={() => handleOpenDetail(dish)}
                className={`glass-card-hover rounded-3xl overflow-hidden flex flex-col justify-between group shadow-luxury border border-white/5 hover:border-amber-500/30 transition-all duration-300 cursor-pointer ${
                  !dish.isAvailable ? 'opacity-50 grayscale' : ''
                }`}
              >
                <div>
                  {/* Dish Image Container */}
                  <div className="relative h-52 overflow-hidden bg-dark-900">
                    <img
                      src={dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                      alt={dish.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      loading="lazy"
                      onError={(e: any) => {
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent opacity-80" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {hasDiscount && dish.isAvailable && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          -{dish.discount}%
                        </span>
                      )}
                      {dish.isBestSeller && dish.isAvailable && (
                        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-200" />
                          Best Seller
                        </span>
                      )}
                      {dish.isNew && dish.isAvailable && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                          Món Mới
                        </span>
                      )}
                    </div>

                    {/* Out of Stock Overlay */}
                    {!dish.isAvailable && (
                      <div className="absolute inset-0 bg-dark-950/85 backdrop-blur-sm flex items-center justify-center p-4">
                        <span className="px-3.5 py-1.5 bg-rose-600/90 border border-rose-500 text-white text-xs font-black rounded-xl shadow-lg uppercase tracking-wider">
                          Tạm Hết Món
                        </span>
                      </div>
                    )}

                    {/* Bottom Metadata Badges */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px]">
                      <span className="px-2.5 py-1 rounded-full bg-dark-950/80 backdrop-blur-md text-amber-300 font-bold border border-white/10 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {dish.preparationTimeMinutes} phút
                      </span>

                      {dish.calories && (
                        <span className="px-2.5 py-1 rounded-full bg-dark-950/80 backdrop-blur-md text-slate-300 font-semibold border border-white/10 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {dish.calories} kcal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dish Info */}
                  <div className="p-5">
                    {/* Rating & Spicy row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1 text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-black">{dish.rating.toFixed(1)}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({dish.reviewCount || 0})
                        </span>
                      </div>

                      {dish.spicyLevel && dish.spicyLevel !== 'NONE' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                          {dish.spicyLevel === 'MILD' && '🌶️ Cay nhẹ'}
                          {dish.spicyLevel === 'MEDIUM' && '🌶️🌶️ Cay vừa'}
                          {dish.spicyLevel === 'HOT' && '🌶️🌶️🌶️ Cay nồng'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-base text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                      {dish.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed font-light">
                      {dish.shortDescription || dish.description || 'Chế biến công phu từ nguồn nguyên liệu tươi hảo hạng.'}
                    </p>

                    {/* Tag Pills */}
                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-dark-850 text-slate-400 text-[10px] border border-white/5 font-medium"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Price & Quick Action */}
                <div className="p-5 pt-0 border-t border-white/5 flex items-center justify-between mt-2">
                  <div>
                    <span className="text-base font-black text-amber-400">
                      {currentPrice.toLocaleString('vi-VN')} đ
                    </span>
                    {hasDiscount && (
                      <span className="block text-[11px] text-slate-500 line-through">
                        {originalPrice.toLocaleString('vi-VN')} đ
                      </span>
                    )}
                  </div>

                  {dish.isAvailable ? (
                    <button
                      onClick={(e) => handleQuickAdd(e, dish)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-md shadow-orange-600/30 hover:scale-105 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-800/40">
                      Tạm Hết
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= RICH PRODUCT DETAIL & CUSTOMIZATION MODAL ================= */}
      {detailDish && (
        <div className="fixed inset-0 bg-dark-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-dark-900 border border-white/10 w-full max-w-2xl rounded-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  {detailDish.category && (
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                      {detailDish.category.name}
                    </span>
                  )}
                  {detailDish.isBestSeller && (
                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                      Best Seller
                    </span>
                  )}
                </div>
                <h2 className="font-serif text-2xl font-black text-white mt-1.5">{detailDish.name}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{detailDish.rating.toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">({detailDish.reviewCount} đánh giá)</span>
                  </div>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Đã bán {detailDish.soldCount || 100}+ phần</span>
                </div>
              </div>

              <button
                onClick={() => setDetailDish(null)}
                className="p-2 rounded-2xl bg-dark-850 text-slate-400 hover:text-white border border-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gallery Viewer */}
            {(() => {
              const gallery = safeParseJson<string[]>(detailDish.gallery, [
                detailDish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
              ]);
              const activeImage = gallery[activeImageIdx] || gallery[0];

              return (
                <div className="py-4">
                  <div className="relative h-60 sm:h-72 w-full rounded-2xl overflow-hidden bg-dark-950 border border-white/5">
                    <img
                      src={activeImage}
                      alt={detailDish.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-dark-950/80 backdrop-blur-md text-amber-300 text-xs font-bold border border-white/10 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Thời gian chế biến: {detailDish.preparationTimeMinutes} phút
                    </div>
                  </div>

                  {/* Thumbnail Selector */}
                  {gallery.length > 1 && (
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                      {gallery.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImageIdx(i)}
                          className={`w-16 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                            activeImageIdx === i ? 'border-amber-500 scale-105' : 'border-white/10 opacity-60'
                          }`}
                        >
                          <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Tabs */}
            <div className="flex border-b border-white/10 mb-5">
              <button
                onClick={() => setModalTab('customize')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                  modalTab === 'customize'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Tùy Biến & Dinh Dưỡng
              </button>
              <button
                onClick={() => setModalTab('reviews')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                  modalTab === 'reviews'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Đánh Giá Thực Khách ({detailDish.reviews?.length || detailDish.reviewCount || 0})
              </button>
            </div>

            {/* TAB 1: CUSTOMIZATION & NUTRITION */}
            {modalTab === 'customize' && (
              <div className="space-y-6">
                {/* Culinary Description */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Mô tả món ăn</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-light">
                    {detailDish.description || detailDish.shortDescription || 'Món ăn hảo hạng được đầu bếp chọn lựa nguyên liệu kỹ càng và chế biến theo công thức độc quyền.'}
                  </p>
                </div>

                {/* Ingredients & Allergens */}
                {(() => {
                  const ingredients = safeParseJson<string[]>(detailDish.ingredients, []);
                  const allergens = safeParseJson<string[]>(detailDish.allergens, []);

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-dark-850/50 p-4 rounded-2xl border border-white/5">
                      <div>
                        <span className="text-[11px] font-bold text-amber-400 block mb-1.5">
                          🥗 Nguyên liệu chính:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ingredients.length > 0 ? (
                            ingredients.map((ing, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-dark-800 text-slate-300 text-[10px] border border-white/5"
                              >
                                {ing}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-500">Nguyên liệu tươi chọn lọc</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-rose-400 block mb-1.5">
                          ⚠️ Lưu ý dị ứng:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {allergens.length > 0 ? (
                            allergens.map((alg, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-medium"
                              >
                                {alg}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-emerald-400">Không có chất gây dị ứng phổ biến</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Nutrition Breakdown */}
                {(() => {
                  const nutrition = safeParseJson<NutritionInfo>(detailDish.nutrition, {
                    calories: detailDish.calories || 450,
                    protein: 24,
                    carbs: 45,
                    fat: 18,
                  });

                  return (
                    <div className="bg-dark-850 p-4 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-200">Giá trị dinh dưỡng chuẩn</span>
                        <span className="text-[10px] text-slate-400">Khẩu phần: {detailDish.servingSize || '1 phần'}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-dark-900 border border-white/5">
                          <span className="text-[10px] text-slate-400 block">Năng lượng</span>
                          <span className="text-sm font-black text-amber-400">{nutrition.calories || detailDish.calories || 450} kcal</span>
                        </div>
                        <div className="p-2 rounded-xl bg-dark-900 border border-white/5">
                          <span className="text-[10px] text-slate-400 block">Chất đạm</span>
                          <span className="text-sm font-black text-emerald-400">{nutrition.protein || 20} g</span>
                        </div>
                        <div className="p-2 rounded-xl bg-dark-900 border border-white/5">
                          <span className="text-[10px] text-slate-400 block">Tinh bột</span>
                          <span className="text-sm font-black text-blue-400">{nutrition.carbs || 40} g</span>
                        </div>
                        <div className="p-2 rounded-xl bg-dark-900 border border-white/5">
                          <span className="text-[10px] text-slate-400 block">Chất béo</span>
                          <span className="text-sm font-black text-purple-400">{nutrition.fat || 15} g</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 italic">
                        * Giá trị dinh dưỡng mang tính chất ước tính dựa trên công thức chế biến chuẩn.
                      </p>
                    </div>
                  );
                })()}

                {/* Modifiers List */}
                {detailDish.modifierGroups && detailDish.modifierGroups.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Tùy chọn thêm cho món ăn
                    </h4>

                    {detailDish.modifierGroups.map((mg) => {
                      const group = mg.modifierGroup;
                      const isSingle = group.maxSelect === 1;

                      return (
                        <div key={group.id} className="border-b border-white/5 pb-4">
                          <div className="flex items-center justify-between mb-2.5">
                            <label className="text-xs font-bold text-slate-200">{group.name}</label>
                            <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                              {group.isRequired ? 'Bắt buộc chọn' : 'Tùy chọn'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.items?.map((item) => {
                              const isChecked = modalModifiers.includes(item.id);
                              return (
                                <label
                                  key={item.id}
                                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-bold shadow-glow-amber'
                                      : 'bg-dark-850 border-white/5 text-slate-300 hover:border-white/15'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type={isSingle ? 'radio' : 'checkbox'}
                                      name={`group_${group.id}`}
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isSingle) {
                                          const filtered = modalModifiers.filter(
                                            (id) => !group.items.some((i) => i.id === id)
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
                                      className="text-amber-500 focus:ring-amber-500 accent-amber-500"
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
                  </div>
                )}

                {/* Kitchen Note */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    Ghi chú cho bếp trưởng
                  </label>
                  <input
                    type="text"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    placeholder="Ví dụ: Ít cay, không hành tây, ăn kèm sốt riêng..."
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                  />
                </div>

                {/* Quantity Stepper & Price Calculation */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-slate-200">Số lượng:</span>
                  <div className="flex items-center gap-3 bg-dark-850 p-1.5 rounded-2xl border border-white/10">
                    <button
                      onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                      className="w-8 h-8 rounded-xl bg-dark-900 text-slate-300 hover:text-white flex items-center justify-center font-bold transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-extrabold text-sm w-6 text-center text-amber-400">
                      {modalQty}
                    </span>
                    <button
                      onClick={() => setModalQty(modalQty + 1)}
                      className="w-8 h-8 rounded-xl bg-dark-900 text-slate-300 hover:text-white flex items-center justify-center font-bold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add to Cart CTA */}
                <button
                  onClick={handleModalAddToCart}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-orange-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Thêm Vào Giỏ Hàng — {modalTotalPrice.toLocaleString('vi-VN')} đ</span>
                </button>

                {/* Related Dishes */}
                {detailDish.relatedDishes && detailDish.relatedDishes.length > 0 && (
                  <div className="pt-6 border-t border-white/10">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                      Gợi ý món dùng kèm hoàn hảo
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {detailDish.relatedDishes.map((rd) => (
                        <div
                          key={rd.id}
                          onClick={() => handleOpenDetail(rd)}
                          className="bg-dark-850 p-2.5 rounded-2xl border border-white/5 hover:border-amber-500/30 cursor-pointer transition text-left group"
                        >
                          <img
                            src={rd.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80'}
                            alt={rd.name}
                            className="w-full h-20 object-cover rounded-xl mb-2 group-hover:scale-105 transition"
                          />
                          <p className="text-[11px] font-bold text-white group-hover:text-amber-400 line-clamp-1">
                            {rd.name}
                          </p>
                          <p className="text-[11px] font-black text-amber-400 mt-0.5">
                            {(rd.discountedPrice || rd.price).toLocaleString('vi-VN')} đ
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REVIEWS */}
            {modalTab === 'reviews' && (
              <div className="space-y-6">
                {/* Score summary */}
                <div className="flex items-center gap-6 p-4 rounded-2xl bg-dark-850 border border-white/5">
                  <div className="text-center">
                    <span className="text-3xl font-black text-amber-400">{detailDish.rating.toFixed(1)}</span>
                    <div className="flex items-center justify-center gap-0.5 mt-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {detailDish.reviewCount || 0} lượt đánh giá
                    </span>
                  </div>
                  <div className="border-l border-white/10 pl-6 text-xs text-slate-300 font-light">
                    <p className="font-semibold text-white">100% Đánh giá từ thực khách đã trải nghiệm</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Tất cả các món ăn được chuẩn bị tươi mới mỗi ngày. Mọi đóng góp của bạn là động lực để nhà hàng hoàn thiện hơn.
                    </p>
                  </div>
                </div>

                {/* Write Review Form */}
                <form onSubmit={handleSubmitReview} className="bg-dark-850 p-4 rounded-2xl border border-white/5 space-y-3">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    ✍️ Viết đánh giá của bạn
                  </span>

                  {reviewMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      {reviewMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300">Chọn số sao:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReviewRating(star)}
                          className="p-1 hover:scale-110 transition"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= newReviewRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={newReviewerName}
                    onChange={(e) => setNewReviewerName(e.target.value)}
                    placeholder="Tên của bạn..."
                    className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                  />

                  <textarea
                    rows={2}
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="Chia sẻ cảm nhận về hương vị, độ tươi và cách trình bày..."
                    className="w-full bg-dark-900 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                  />

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}</span>
                  </button>
                </form>

                {/* Reviews List */}
                <div className="space-y-3">
                  {detailDish.reviews && detailDish.reviews.length > 0 ? (
                    detailDish.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-2xl bg-dark-850/60 border border-white/5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                rev.avatar ||
                                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80'
                              }
                              alt={rev.userName}
                              className="w-7 h-7 rounded-full object-cover border border-white/10"
                            />
                            <div>
                              <span className="text-xs font-bold text-white block">{rev.userName}</span>
                              <span className="text-[10px] text-emerald-400">Đã trải nghiệm tại quán</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < rev.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 font-light leading-relaxed pl-9">
                          {rev.comment}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Chưa có đánh giá nào cho món này. Hãy là người đầu tiên trải nghiệm và chia sẻ!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default MenuPage;
