import React from 'react';
import { TrendingUp, Utensils } from 'lucide-react';

interface TopDish {
  dishId: number;
  name: string;
  price: number;
  imageUrl?: string;
  totalSold: number;
  totalRevenue: number;
}

interface TopDishesChartProps {
  dishes: TopDish[];
}

export const TopDishesChart: React.FC<TopDishesChartProps> = ({ dishes }) => {
  const maxSold = Math.max(...dishes.map((d) => d.totalSold), 1);

  return (
    <div className="space-y-4 pt-2">
      {dishes.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          Chưa có dữ liệu gọi món hôm nay.
        </div>
      ) : (
        dishes.map((dish, idx) => {
          const percent = Math.round((dish.totalSold / maxSold) * 100);
          return (
            <div key={dish.dishId} className="group flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-xs font-bold text-slate-400 group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
                    #{idx + 1}
                  </span>
                  {dish.imageUrl ? (
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                      <Utensils className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {dish.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dish.price.toLocaleString('vi-VN')} đ / phần
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-amber-400">
                    {dish.totalRevenue.toLocaleString('vi-VN')} đ
                  </p>
                  <p className="text-xs font-medium text-emerald-400 flex items-center justify-end gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {dish.totalSold} đã bán
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
