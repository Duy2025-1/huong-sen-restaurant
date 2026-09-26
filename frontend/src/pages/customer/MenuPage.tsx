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
  Utensils,
  LayoutGrid,
  List,
  ChevronRight,
  ShieldAlert,
  Send,
  Heart
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
  const [viewMode, setViewMode] = useState<'grid' | 'editorial'>('grid');

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
        if (selectedPriceRange === 'under80' && price >= 80000) return false;
        if (selectedPriceRange === '80to150' && (price < 80000 || price > 150000)) return false;
        if (selectedPriceRange === '150to250' && (price < 150000 || price > 250000)) return false;
        if (selectedPriceRange === 'above250' && price <= 250000) return false;

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
      showToast(`Đã thêm "${dish.name}" vào giỏ`);
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
    showToast(`Đã thêm ${modalQty} phần "${detailDish.name}" vào giỏ hàng`);
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

      setReviewMsg('Cảm ơn bạn! Lời cảm nhận đã được ghi nhận vào sổ nhật ký.');
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
    <div className="min-h-screen bg-cream-50 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-wood-900 font-sans">
      {/* Toast Alert */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-lotus-900 text-cream-50 px-5 py-3.5 rounded-2xl shadow-lift flex items-center gap-3 border border-lotus-700 animate-in slide-in-from-bottom duration-300">
          <div className="w-8 h-8 rounded-full bg-lotus-700 text-cream-100 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-cream-50">{addedToast}</p>
            <p className="text-[11px] text-cream-300">Kiểm tra giỏ hàng để hoàn tất gọi món</p>
          </div>
          <button
            onClick={() => setIsCartOpen(true)}
            className="ml-3 px-3.5 py-1.5 bg-terracotta hover:bg-terracotta-dark text-white rounded-xl text-[11px] font-bold shadow transition"
          >
            Mở giỏ
          </button>
        </div>
      )}

      {/* Header Banner - Editorial Culinary style */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 pb-8 border-b border-wood-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lotus-50 border border-lotus-200 text-lotus-800 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-ochre-600" />
            <span>Thực Đơn Thuần Việt • Ba Miền Đậm Vị</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-lotus-900 tracking-tight">
            Thực Đơn Nhà Hàng Hương Sen
          </h1>
          <p className="text-sm text-wood-600 mt-2 max-w-2xl leading-relaxed">
            Hơn 100 món ăn truyền thống được chế biến từ nông sản Việt sạch tươi mỗi ngày — từ món gỏi nộm thanh mát, canh chua thơm lừng, cá kho tộ đậm đà đến những nồi lẩu quây quần ấm cúng.
          </p>
        </div>

        {/* Search Input & View Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-wood-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Tìm món, nguyên liệu, hương vị..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-wood-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 focus:ring-1 focus:ring-lotus-600 shadow-subtle transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-wood-400 hover:text-wood-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Grid vs Editorial Dot-Leader */}
          <div className="inline-flex items-center p-1 bg-white border border-wood-200 rounded-xl shadow-subtle shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'grid'
                  ? 'bg-lotus-800 text-cream-50 font-bold shadow-sm'
                  : 'text-wood-600 hover:text-wood-900'
              }`}
              title="Dạng lưới hình ảnh"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Hình ảnh</span>
            </button>
            <button
              onClick={() => setViewMode('editorial')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'editorial'
                  ? 'bg-lotus-800 text-cream-50 font-bold shadow-sm'
                  : 'text-wood-600 hover:text-wood-900'
              }`}
              title="Dạng thực đơn cổ điển (Dot-leader)"
            >
              <List className="w-3.5 h-3.5" />
              <span>Thực đơn giấy</span>
            </button>
          </div>
        </div>
      </div>

      {/* 15 Vietnamese Categories Horizontal Bar */}
      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none">
          <button
            onClick={() => setSelectedCatId('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCatId === 'all'
                ? 'bg-lotus-800 text-cream-50 shadow-sm'
                : 'bg-white text-wood-600 hover:text-wood-900 hover:bg-cream-100 border border-wood-200'
            }`}
          >
            <span>Tất Cả Món</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                selectedCatId === 'all' ? 'bg-lotus-700 text-cream-100' : 'bg-cream-200 text-wood-700'
              }`}
            >
              {allDishes.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-lotus-800 text-cream-50 shadow-sm'
                    : 'bg-white text-wood-600 hover:text-wood-900 hover:bg-cream-100 border border-wood-200'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-lotus-700 text-cream-100' : 'bg-cream-200 text-wood-700'
                  }`}
                >
                  {cat.dishes.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Filter & Sort Toolbar */}
      <div className="bg-white border border-wood-200 rounded-2xl p-4 mb-8 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-wood-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-lotus-700" />
            Lọc theo:
          </span>

          <button
            onClick={() => setQuickFilter(quickFilter === 'bestseller' ? 'all' : 'bestseller')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              quickFilter === 'bestseller'
                ? 'bg-ochre-600 text-white font-bold'
                : 'bg-cream-100 text-wood-700 hover:bg-cream-200 border border-wood-200'
            }`}
          >
            🔥 Bán chạy nhất
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'popular' ? 'all' : 'popular')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              quickFilter === 'popular'
                ? 'bg-lotus-700 text-white font-bold'
                : 'bg-cream-100 text-wood-700 hover:bg-cream-200 border border-wood-200'
            }`}
          >
            ⭐ Thực khách yêu thích
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'new' ? 'all' : 'new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              quickFilter === 'new'
                ? 'bg-lotus-800 text-white font-bold'
                : 'bg-cream-100 text-wood-700 hover:bg-cream-200 border border-wood-200'
            }`}
          >
            ✨ Món mới mùa này
          </button>

          <button
            onClick={() => setQuickFilter(quickFilter === 'discount' ? 'all' : 'discount')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              quickFilter === 'discount'
                ? 'bg-terracotta text-white font-bold'
                : 'bg-cream-100 text-wood-700 hover:bg-cream-200 border border-wood-200'
            }`}
          >
            🏷️ Ưu đãi đặc biệt
          </button>
        </div>

        {/* Dropdown Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Spicy Level */}
          <select
            value={selectedSpicy}
            onChange={(e) => setSelectedSpicy(e.target.value)}
            className="bg-cream-50 border border-wood-200 rounded-lg px-3 py-1.5 text-xs text-wood-800 focus:outline-none focus:border-lotus-600"
          >
            <option value="all">Độ cay: Tất cả</option>
            <option value="NONE">Không cay</option>
            <option value="MILD">Cay dịu nhẹ 🌶️</option>
            <option value="MEDIUM">Cay vừa 🌶️🌶️</option>
            <option value="HOT">Cay nồng 🌶️🌶️🌶️</option>
          </select>

          {/* Price Range */}
          <select
            value={selectedPriceRange}
            onChange={(e) => setSelectedPriceRange(e.target.value)}
            className="bg-cream-50 border border-wood-200 rounded-lg px-3 py-1.5 text-xs text-wood-800 focus:outline-none focus:border-lotus-600"
          >
            <option value="all">Mức giá: Tất cả</option>
            <option value="under80">Dưới 80.000 đ</option>
            <option value="80to150">80.000 đ - 150.000 đ</option>
            <option value="150to250">150.000 đ - 250.000 đ</option>
            <option value="above250">Trên 250.000 đ</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-cream-50 border border-wood-200 rounded-lg px-3 py-1.5 text-xs text-lotus-800 font-bold focus:outline-none focus:border-lotus-600"
          >
            <option value="popular">Sắp xếp: Phổ biến nhất</option>
            <option value="rating">Đánh giá cao nhất</option>
            <option value="bestseller">Số lượng bán nhiều nhất</option>
            <option value="price_asc">Giá: Thấp đến Cao</option>
            <option value="price_desc">Giá: Cao đến Thấp</option>
            <option value="newest">Món mới nhất</option>
          </select>

          {/* Reset Filters */}
          {isAnyFilterActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-terracotta/10 hover:bg-terracotta/20 text-terracotta border border-terracotta/20 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-wood-600">
          Hiển thị <span className="text-lotus-800 font-bold">{filteredDishes.length}</span> món
          {selectedCatId !== 'all' && categories.find((c) => c.id === selectedCatId) && (
            <span> trong danh mục <strong className="text-wood-900">{categories.find((c) => c.id === selectedCatId)?.name}</strong></span>
          )}
        </p>
      </div>

      {/* Dishes Render */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-lotus-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-wood-600 font-serif">Bếp đang chuẩn bị thực đơn hảo vị...</p>
        </div>
      ) : filteredDishes.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-2xl border border-wood-200 p-8 shadow-subtle">
          <Utensils className="w-12 h-12 text-wood-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-wood-900">Không tìm thấy món ăn phù hợp</h3>
          <p className="text-xs text-wood-600 mt-1 max-w-sm mx-auto">
            Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Đặt lại" để xem toàn bộ danh mục thực đơn thuần Việt.
          </p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 bg-lotus-800 hover:bg-lotus-900 text-cream-50 rounded-xl text-xs font-bold transition shadow-sm"
          >
            Xem Toàn Bộ Thực Đơn
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= 1. MODERN EDITORIAL GRID VIEW ================= */
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
                className={`bg-white rounded-2xl overflow-hidden flex flex-col justify-between group shadow-subtle hover:shadow-lift border border-wood-200 hover:border-lotus-300 transition-all duration-300 cursor-pointer ${
                  !dish.isAvailable ? 'opacity-60 grayscale' : ''
                }`}
              >
                <div>
                  {/* Dish Image Container */}
                  <div className="relative h-52 overflow-hidden bg-cream-100">
                    <img
                      src={dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'}
                      alt={dish.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      loading="lazy"
                      onError={(e: any) => {
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {hasDiscount && dish.isAvailable && (
                        <span className="px-2.5 py-0.5 rounded-full bg-terracotta text-white text-[10px] font-bold uppercase tracking-wider shadow">
                          -{dish.discount}%
                        </span>
                      )}
                      {dish.isBestSeller && dish.isAvailable && (
                        <span className="px-2.5 py-0.5 rounded-full bg-ochre-600 text-white text-[10px] font-bold uppercase tracking-wider shadow flex items-center gap-1">
                          <Flame className="w-3 h-3 text-cream-100" />
                          Bán chạy
                        </span>
                      )}
                      {dish.isNew && dish.isAvailable && (
                        <span className="px-2.5 py-0.5 rounded-full bg-lotus-700 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                          Món mới
                        </span>
                      )}
                    </div>

                    {/* Out of Stock Overlay */}
                    {!dish.isAvailable && (
                      <div className="absolute inset-0 bg-wood-950/70 backdrop-blur-xs flex items-center justify-center p-4">
                        <span className="px-3.5 py-1.5 bg-wood-800 text-cream-100 text-xs font-bold rounded-xl shadow uppercase tracking-wider">
                          Tạm hết món
                        </span>
                      </div>
                    )}

                    {/* Bottom Metadata Badges */}
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cream-200" />
                        {dish.preparationTimeMinutes} phút
                      </span>

                      {dish.calories && (
                        <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm flex items-center gap-1">
                          <Flame className="w-3 h-3 text-ochre-400" />
                          {dish.calories} kcal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dish Info */}
                  <div className="p-4 sm:p-5">
                    {/* Rating & Spicy row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1 text-ochre-600">
                        <Star className="w-3.5 h-3.5 fill-ochre-500 text-ochre-500" />
                        <span className="text-xs font-bold">{dish.rating.toFixed(1)}</span>
                        <span className="text-[10px] text-wood-400">
                          ({dish.reviewCount || 0})
                        </span>
                      </div>

                      {dish.spicyLevel && dish.spicyLevel !== 'NONE' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-terracotta/10 text-terracotta font-medium border border-terracotta/20">
                          {dish.spicyLevel === 'MILD' && '🌶️ Cay nhẹ'}
                          {dish.spicyLevel === 'MEDIUM' && '🌶️🌶️ Cay vừa'}
                          {dish.spicyLevel === 'HOT' && '🌶️🌶️🌶️ Cay nồng'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-base text-wood-900 group-hover:text-lotus-800 transition-colors line-clamp-1">
                      {dish.name}
                    </h3>
                    <p className="text-xs text-wood-600 mt-1 line-clamp-2 leading-relaxed">
                      {dish.shortDescription || dish.description || 'Chế biến công phu từ nguồn nguyên liệu tươi hảo hạng.'}
                    </p>

                    {/* Tag Pills */}
                    {tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-cream-100 text-wood-600 text-[10px] border border-wood-200"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Price & Quick Action */}
                <div className="p-4 sm:p-5 pt-0 border-t border-wood-100 flex items-center justify-between mt-1">
                  <div>
                    <span className="text-base font-bold text-lotus-800">
                      {currentPrice.toLocaleString('vi-VN')} đ
                    </span>
                    {hasDiscount && (
                      <span className="block text-[11px] text-wood-400 line-through">
                        {originalPrice.toLocaleString('vi-VN')} đ
                      </span>
                    )}
                  </div>

                  {dish.isAvailable ? (
                    <button
                      onClick={(e) => handleQuickAdd(e, dish)}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 text-xs font-bold transition shadow-sm active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-wood-500 bg-cream-200 px-2.5 py-1 rounded-lg">
                      Tạm Hết
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= 2. CLASSIC EDITORIAL DOT-LEADER VIEW ================= */
        <div className="space-y-10">
          {(selectedCatId === 'all'
            ? categories
            : categories.filter((c) => c.id === selectedCatId)
          ).map((cat) => {
            const catDishes = cat.dishes.filter((d) => filteredDishes.some((fd) => fd.id === d.id));
            if (catDishes.length === 0) return null;

            return (
              <div key={cat.id} className="bg-white rounded-3xl p-6 sm:p-10 border border-wood-200 shadow-subtle">
                <div className="text-center mb-8 pb-4 border-b border-wood-200">
                  <span className="text-xs uppercase tracking-widest text-ochre-700 font-bold block mb-1">
                    Hương Vị Đặc Trưng
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-lotus-900">
                    {cat.name}
                  </h2>
                  <div className="w-12 h-0.5 bg-lotus-700 mx-auto mt-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {catDishes.map((dish) => {
                    const currentPrice = dish.discountedPrice || dish.price;
                    return (
                      <div
                        key={dish.id}
                        onClick={() => handleOpenDetail(dish)}
                        className="group cursor-pointer hover:bg-cream-50/80 p-3 rounded-xl transition"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif font-bold text-sm sm:text-base text-wood-900 group-hover:text-lotus-800 transition-colors">
                            {dish.name}
                            {dish.isBestSeller && (
                              <span className="ml-2 text-[10px] text-ochre-700 font-sans font-bold uppercase tracking-wider">
                                [Bán Chạy]
                              </span>
                            )}
                          </span>

                          <span className="flex-1 border-b border-dotted border-wood-300 mx-2" />

                          <span className="font-serif font-bold text-sm sm:text-base text-lotus-800 whitespace-nowrap">
                            {currentPrice.toLocaleString('vi-VN')} đ
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-wood-600 line-clamp-1 italic font-serif">
                            {dish.shortDescription || dish.description || 'Hương vị cổ truyền đặc trưng.'}
                          </p>
                          <button
                            onClick={(e) => handleQuickAdd(e, dish)}
                            className="text-[11px] font-bold text-lotus-800 hover:text-lotus-900 hover:underline shrink-0 ml-3"
                          >
                            + Chọn món
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= RICH PRODUCT DETAIL & CUSTOMIZATION MODAL ================= */}
      {detailDish && (
        <div className="fixed inset-0 bg-wood-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-cream-50 border border-wood-200 w-full max-w-2xl rounded-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl text-wood-900 animate-in zoom-in-95 duration-200 font-sans">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-wood-200">
              <div>
                <div className="flex items-center gap-2">
                  {detailDish.category && (
                    <span className="text-[10px] text-lotus-800 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-lotus-100 border border-lotus-200">
                      {detailDish.category.name}
                    </span>
                  )}
                  {detailDish.isBestSeller && (
                    <span className="text-[10px] text-ochre-700 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-ochre-100 border border-ochre-300">
                      Bán chạy
                    </span>
                  )}
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-lotus-900 mt-1.5">{detailDish.name}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <div className="flex items-center gap-1 text-ochre-600 font-bold">
                    <Star className="w-4 h-4 fill-ochre-500 text-ochre-500" />
                    <span>{detailDish.rating.toFixed(1)}</span>
                    <span className="text-wood-500 font-normal">({detailDish.reviewCount} lượt đánh giá)</span>
                  </div>
                  <span className="text-wood-400">•</span>
                  <span className="text-wood-600">Đã phục vụ {detailDish.soldCount || 100}+ phần</span>
                </div>
              </div>

              <button
                onClick={() => setDetailDish(null)}
                className="p-2 rounded-xl bg-white text-wood-500 hover:text-wood-900 border border-wood-200 transition shadow-subtle"
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
                  <div className="relative h-60 sm:h-72 w-full rounded-2xl overflow-hidden bg-cream-200 border border-wood-200 shadow-subtle">
                    <img
                      src={activeImage}
                      alt={detailDish.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-cream-100 text-xs font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-ochre-300" />
                      Chế biến: {detailDish.preparationTimeMinutes} phút
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
                            activeImageIdx === i ? 'border-lotus-800 scale-105' : 'border-wood-200 opacity-70'
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
            <div className="flex border-b border-wood-200 mb-5">
              <button
                onClick={() => setModalTab('customize')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                  modalTab === 'customize'
                    ? 'border-lotus-800 text-lotus-800'
                    : 'border-transparent text-wood-500 hover:text-wood-800'
                }`}
              >
                Tùy Biến & Dinh Dưỡng
              </button>
              <button
                onClick={() => setModalTab('reviews')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                  modalTab === 'reviews'
                    ? 'border-lotus-800 text-lotus-800'
                    : 'border-transparent text-wood-500 hover:text-wood-800'
                }`}
              >
                Nhật Ký Thực Khách ({detailDish.reviews?.length || detailDish.reviewCount || 0})
              </button>
            </div>

            {/* TAB 1: CUSTOMIZATION & NUTRITION */}
            {modalTab === 'customize' && (
              <div className="space-y-6">
                {/* Culinary Description */}
                <div>
                  <h4 className="text-xs font-bold text-wood-700 uppercase tracking-wider mb-1">Mô tả món ăn</h4>
                  <p className="text-xs sm:text-sm text-wood-700 leading-relaxed font-serif">
                    {detailDish.description || detailDish.shortDescription || 'Món ăn hảo hạng được đầu bếp chọn lựa nguyên liệu kỹ càng và chế biến theo công thức độc quyền.'}
                  </p>
                </div>

                {/* Ingredients & Allergens */}
                {(() => {
                  const ingredients = safeParseJson<string[]>(detailDish.ingredients, []);
                  const allergens = safeParseJson<string[]>(detailDish.allergens, []);

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-wood-200 shadow-subtle">
                      <div>
                        <span className="text-[11px] font-bold text-lotus-800 block mb-1.5">
                          🥗 Nguyên liệu chính:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ingredients.length > 0 ? (
                            ingredients.map((ing, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-cream-100 text-wood-800 text-[10px] border border-wood-200 font-medium"
                              >
                                {ing}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-wood-500">Nguyên liệu tươi chọn lọc</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-terracotta block mb-1.5">
                          ⚠️ Lưu ý dị ứng:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {allergens.length > 0 ? (
                            allergens.map((alg, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-terracotta/10 text-terracotta border border-terracotta/20 text-[10px] font-medium"
                              >
                                {alg}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-lotus-700">Không có chất gây dị ứng phổ biến</span>
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
                    <div className="bg-white p-4 rounded-2xl border border-wood-200 shadow-subtle">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-wood-900">Giá trị dinh dưỡng chuẩn</span>
                        <span className="text-[10px] text-wood-500">Khẩu phần: {detailDish.servingSize || '1 phần'}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-cream-50 border border-wood-100">
                          <span className="text-[10px] text-wood-500 block">Năng lượng</span>
                          <span className="text-sm font-bold text-ochre-700">{nutrition.calories || detailDish.calories || 450} kcal</span>
                        </div>
                        <div className="p-2 rounded-xl bg-cream-50 border border-wood-100">
                          <span className="text-[10px] text-wood-500 block">Chất đạm</span>
                          <span className="text-sm font-bold text-lotus-800">{nutrition.protein || 20} g</span>
                        </div>
                        <div className="p-2 rounded-xl bg-cream-50 border border-wood-100">
                          <span className="text-[10px] text-wood-500 block">Tinh bột</span>
                          <span className="text-sm font-bold text-wood-800">{nutrition.carbs || 40} g</span>
                        </div>
                        <div className="p-2 rounded-xl bg-cream-50 border border-wood-100">
                          <span className="text-[10px] text-wood-500 block">Chất béo</span>
                          <span className="text-sm font-bold text-terracotta">{nutrition.fat || 15} g</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-wood-400 mt-2 italic">
                        * Giá trị dinh dưỡng mang tính chất tham khảo chuẩn công thức bếp Hương Sen.
                      </p>
                    </div>
                  );
                })()}

                {/* Modifiers List */}
                {detailDish.modifierGroups && detailDish.modifierGroups.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold text-lotus-900 uppercase tracking-wider">
                      Tùy chọn khẩu vị & món ăn kèm
                    </h4>

                    {detailDish.modifierGroups.map((mg) => {
                      const group = mg.modifierGroup;
                      const isSingle = group.maxSelect === 1;

                      return (
                        <div key={group.id} className="border-b border-wood-200 pb-4">
                          <div className="flex items-center justify-between mb-2.5">
                            <label className="text-xs font-bold text-wood-900">{group.name}</label>
                            <span className="text-[10px] text-wood-500 bg-cream-200 px-2 py-0.5 rounded-full font-medium">
                              {group.isRequired ? 'Bắt buộc chọn' : 'Tùy chọn'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.items?.map((item) => {
                              const isChecked = modalModifiers.includes(item.id);
                              return (
                                <label
                                  key={item.id}
                                  className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                    isChecked
                                      ? 'bg-lotus-50 border-lotus-600 text-lotus-900 font-bold shadow-subtle'
                                      : 'bg-white border-wood-200 text-wood-700 hover:border-wood-300'
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
                                      className="text-lotus-700 focus:ring-lotus-600 accent-lotus-700"
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
                  </div>
                )}

                {/* Kitchen Note */}
                <div>
                  <label className="block text-xs font-bold text-wood-900 mb-1.5">
                    Ghi chú riêng cho đầu bếp
                  </label>
                  <input
                    type="text"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    placeholder="Ví dụ: Ít cay, không hành ngò, xin thêm nước chấm..."
                    className="w-full bg-white border border-wood-200 rounded-xl p-3 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle transition"
                  />
                </div>

                {/* Quantity Stepper & Price Calculation */}
                <div className="flex items-center justify-between pt-2 border-t border-wood-200">
                  <span className="text-xs font-bold text-wood-900">Số lượng phần ăn:</span>
                  <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-wood-200 shadow-subtle">
                    <button
                      onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                      className="w-8 h-8 rounded-lg bg-cream-100 text-wood-700 hover:text-wood-900 flex items-center justify-center font-bold transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm w-6 text-center text-lotus-900">
                      {modalQty}
                    </span>
                    <button
                      onClick={() => setModalQty(modalQty + 1)}
                      className="w-8 h-8 rounded-lg bg-cream-100 text-wood-700 hover:text-wood-900 flex items-center justify-center font-bold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Add to Cart CTA */}
                <button
                  onClick={handleModalAddToCart}
                  className="w-full py-3.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-sm shadow-subtle transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Thêm Vào Giỏ — {modalTotalPrice.toLocaleString('vi-VN')} đ</span>
                </button>

                {/* Related Dishes */}
                {detailDish.relatedDishes && detailDish.relatedDishes.length > 0 && (
                  <div className="pt-6 border-t border-wood-200">
                    <h4 className="text-xs font-bold text-wood-700 uppercase tracking-wider mb-3">
                      Gợi ý món dùng kèm hòa hợp
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {detailDish.relatedDishes.map((rd) => (
                        <div
                          key={rd.id}
                          onClick={() => handleOpenDetail(rd)}
                          className="bg-white p-2.5 rounded-xl border border-wood-200 hover:border-lotus-400 cursor-pointer transition text-left group shadow-subtle"
                        >
                          <img
                            src={rd.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80'}
                            alt={rd.name}
                            className="w-full h-20 object-cover rounded-lg mb-2 group-hover:scale-105 transition"
                          />
                          <p className="text-[11px] font-bold text-wood-900 group-hover:text-lotus-800 line-clamp-1">
                            {rd.name}
                          </p>
                          <p className="text-[11px] font-bold text-lotus-800 mt-0.5">
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
                <div className="flex items-center gap-6 p-4 rounded-2xl bg-white border border-wood-200 shadow-subtle">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-ochre-600 font-serif">{detailDish.rating.toFixed(1)}</span>
                    <div className="flex items-center justify-center gap-0.5 mt-1 text-ochre-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-3.5 h-3.5 fill-ochre-500 text-ochre-500" />
                      ))}
                    </div>
                    <span className="text-[10px] text-wood-500 mt-1 block">
                      {detailDish.reviewCount || 0} lượt chia sẻ
                    </span>
                  </div>
                  <div className="border-l border-wood-200 pl-6 text-xs text-wood-600">
                    <p className="font-bold text-wood-900">100% Cảm nhận từ thực khách đã thưởng thức</p>
                    <p className="text-wood-600 text-[11px] mt-0.5 leading-relaxed font-serif">
                      Tất cả món ăn được chế biến tươi mới mỗi ngày. Mọi góp ý là nguồn động lực quý giá để bếp Hương Sen hoàn thiện phong vị quê nhà.
                    </p>
                  </div>
                </div>

                {/* Write Review Form */}
                <form onSubmit={handleSubmitReview} className="bg-white p-4 rounded-2xl border border-wood-200 shadow-subtle space-y-3">
                  <span className="text-xs font-bold text-lotus-900 uppercase tracking-wider block">
                    ✍️ Gửi lời cảm nhận của bạn
                  </span>

                  {reviewMsg && (
                    <div className="p-2.5 rounded-xl bg-lotus-50 text-lotus-800 text-xs font-semibold border border-lotus-200">
                      {reviewMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-wood-700">Mức độ hài lòng:</span>
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
                                ? 'fill-ochre-500 text-ochre-500'
                                : 'text-wood-300'
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
                    placeholder="Họ tên của bạn..."
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl p-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600"
                  />

                  <textarea
                    rows={2}
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="Chia sẻ cảm nhận về độ tươi ngon, hương vị và cách bài trí món ăn..."
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl p-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600"
                  />

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 bg-lotus-800 hover:bg-lotus-900 disabled:opacity-50 text-cream-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-subtle"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingReview ? 'Đang gửi...' : 'Gửi cảm nhận'}</span>
                  </button>
                </form>

                {/* Reviews List */}
                <div className="space-y-3">
                  {detailDish.reviews && detailDish.reviews.length > 0 ? (
                    detailDish.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 rounded-2xl bg-white border border-wood-200 shadow-subtle space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                rev.avatar ||
                                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80'
                              }
                              alt={rev.userName}
                              className="w-7 h-7 rounded-full object-cover border border-wood-200"
                            />
                            <div>
                              <span className="text-xs font-bold text-wood-900 block">{rev.userName}</span>
                              <span className="text-[10px] text-lotus-700">Đã trải nghiệm tại quán</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-ochre-500">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < rev.rating
                                    ? 'fill-ochre-500 text-ochre-500'
                                    : 'text-wood-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-wood-700 font-serif leading-relaxed pl-9">
                          "{rev.comment}"
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-wood-500 text-xs italic font-serif">
                      Chưa có lời cảm nhận nào cho món này. Hãy là người đầu tiên trải nghiệm và chia sẻ!
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
