import React from 'react';
import { Clock, ChefHat, CheckCircle2, AlertCircle, ExternalLink, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ChatOrder {
  id: number;
  code: string;
  status: string;
  totalAmount: number;
  createdAt?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface ChatOrderCardProps {
  order: ChatOrder;
}

export const ChatOrderCard: React.FC<ChatOrderCardProps> = ({ order }) => {
  const statusSteps = [
    { key: 'pending', label: 'Tiếp nhận', icon: Clock },
    { key: 'preparing', label: 'Bếp nấu', icon: ChefHat },
    { key: 'ready', label: 'Sẵn sàng', icon: CheckCircle2 },
    { key: 'completed', label: 'Hoàn tất', icon: CheckCircle2 },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'confirmed':
      case 'preparing':
        return 1;
      case 'ready':
      case 'served':
      case 'out_for_delivery':
        return 2;
      case 'completed':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="bg-white rounded-2xl border border-wood-200 shadow-sm p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-wood-100">
        <div>
          <span className="text-[10px] text-wood-500 font-medium">Mã đơn hàng:</span>
          <h4 className="font-serif font-bold text-sm text-lotus-900">#{order.code}</h4>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-wood-500 font-medium">Tổng thanh toán:</span>
          <p className="font-serif font-bold text-xs text-lotus-800">
            {order.totalAmount.toLocaleString('vi-VN')} đ
          </p>
        </div>
      </div>

      {/* Progress Timeline */}
      {!isCancelled ? (
        <div className="py-1">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute left-3 right-3 top-3 -translate-y-1/2 h-0.5 bg-cream-200 z-0" />
            <div
              className="absolute left-3 top-3 -translate-y-1/2 h-0.5 bg-lotus-800 transition-all duration-500 z-0"
              style={{
                width: `${Math.max(0, (currentStep / (statusSteps.length - 1)) * 100)}%`,
              }}
            />

            {statusSteps.map((step, idx) => {
              const isPassed = idx <= currentStep;
              const isCurrent = idx === currentStep;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'bg-lotus-800 text-white ring-4 ring-lotus-100 scale-110'
                        : isPassed
                        ? 'bg-lotus-800 text-white'
                        : 'bg-cream-100 border border-wood-200 text-wood-400'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <span
                    className={`text-[9px] mt-1 font-medium ${
                      isCurrent
                        ? 'text-lotus-800 font-bold'
                        : isPassed
                        ? 'text-wood-700'
                        : 'text-wood-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-2 rounded-xl bg-terracotta/10 border border-terracotta/20 text-terracotta text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Đơn hàng này đã bị hủy.</span>
        </div>
      )}

      {/* Items list preview */}
      {order.items && order.items.length > 0 && (
        <div className="pt-2 border-t border-wood-100 space-y-1">
          <span className="text-[10px] font-bold text-wood-700 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3 text-wood-500" />
            <span>Món đã đặt ({order.items.length}):</span>
          </span>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] text-wood-700 font-light">
                <span className="truncate max-w-[170px]">{it.quantity}x {it.name}</span>
                <span className="font-medium shrink-0">{(it.price * it.quantity).toLocaleString('vi-VN')} đ</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to order lookup */}
      <Link
        to={`/order-lookup?q=${encodeURIComponent(order.code)}`}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-lotus-900 text-xs font-semibold border border-wood-200 transition"
      >
        <span>Xem chi tiết đơn hàng</span>
        <ExternalLink className="w-3 h-3 text-wood-500" />
      </Link>
    </div>
  );
};
