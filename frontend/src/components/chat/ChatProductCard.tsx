import React, { useState } from 'react';
import { Star, Plus, Check, ShoppingBag, Eye } from 'lucide-react';

export interface ChatProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  discountedPrice?: number | null;
  imageUrl?: string;
  rating: number;
  reviewCount: number;
  isAvailable: boolean;
  shortDescription?: string;
  categoryName?: string;
  spicyLevel?: string;
}

interface ChatProductCardProps {
  product: ChatProduct;
  onAddToCart: (product: ChatProduct, quantity: number) => void;
  onViewDetail?: (product: ChatProduct) => void;
}

export const ChatProductCard: React.FC<ChatProductCardProps> = ({
  product,
  onAddToCart,
  onViewDetail,
}) => {
  const [selectedQty, setSelectedQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const displayPrice = product.discountedPrice || product.price;

  const handleAdd = () => {
    if (!product.isAvailable) return;
    onAddToCart(product, selectedQty);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <div className="bg-white rounded-2xl border border-wood-200 shadow-sm overflow-hidden flex flex-col transition hover:shadow-md">
      {/* Product Image & Badges */}
      <div className="relative h-28 w-full bg-cream-100 overflow-hidden">
        <img
          src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Category tag */}
        {product.categoryName && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-wood-900/70 backdrop-blur-sm text-[10px] font-medium text-cream-100">
            {product.categoryName}
          </span>
        )}

        {/* Availability Badge */}
        {!product.isAvailable && (
          <div className="absolute inset-0 bg-wood-950/70 backdrop-blur-xs flex items-center justify-center">
            <span className="px-2.5 py-1 rounded-lg bg-terracotta text-white font-bold text-[10px] tracking-wider uppercase">
              HẾT MÓN
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-1 mb-1">
            <h4 className="font-serif font-bold text-xs sm:text-sm text-lotus-900 line-clamp-1" title={product.name}>
              {product.name}
            </h4>
            <div className="flex items-center gap-0.5 text-ochre-600 font-bold text-[11px] shrink-0">
              <Star className="w-3 h-3 fill-ochre-500 text-ochre-500" />
              <span>{product.rating?.toFixed(1) || '5.0'}</span>
            </div>
          </div>

          {product.shortDescription && (
            <p className="text-[11px] text-wood-600 line-clamp-2 mb-2 font-light leading-relaxed">
              {product.shortDescription}
            </p>
          )}
        </div>

        {/* Price & Actions */}
        <div className="pt-2 border-t border-wood-100 flex items-center justify-between gap-2">
          <div>
            <span className="font-serif font-bold text-xs sm:text-sm text-lotus-800">
              {displayPrice.toLocaleString('vi-VN')} đ
            </span>
            {product.discountedPrice && product.discountedPrice < product.price && (
              <span className="text-[10px] text-wood-400 line-through block -mt-1">
                {product.price.toLocaleString('vi-VN')} đ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onViewDetail && (
              <button
                type="button"
                onClick={() => onViewDetail(product)}
                className="p-1.5 rounded-xl border border-wood-200 text-wood-600 hover:text-lotus-800 hover:border-lotus-300 transition"
                title="Xem món"
                aria-label={`Xem món ${product.name}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            {product.isAvailable ? (
              <div className="flex items-center gap-1">
                {/* Qty Selector Pill */}
                <select
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)}
                  className="bg-cream-100 border border-wood-200 rounded-lg text-[11px] py-1 px-1 font-bold text-wood-800 focus:outline-none"
                  aria-label="Số lượng"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={justAdded}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition shadow-xs ${
                    justAdded
                      ? 'bg-emerald-600 text-white'
                      : 'bg-lotus-800 hover:bg-lotus-900 text-cream-50 active:scale-95'
                  }`}
                  aria-label={`Thêm ${product.name} vào giỏ`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Đã thêm</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Thêm</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-wood-400 italic">Tạm hết</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
