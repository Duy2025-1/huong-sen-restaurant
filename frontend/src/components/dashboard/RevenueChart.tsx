import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface RevenueChartProps {
  data?: Array<{ name: string; total: number; orders: number }>;
}

const defaultData = [
  { name: '10:00', total: 680000, orders: 3 },
  { name: '12:00', total: 2450000, orders: 12 },
  { name: '14:00', total: 1120000, orders: 5 },
  { name: '16:00', total: 890000, orders: 4 },
  { name: '18:00', total: 3820000, orders: 18 },
  { name: '20:00', total: 4650000, orders: 22 },
  { name: '22:00', total: 1780000, orders: 9 },
];

export const RevenueChart: React.FC<RevenueChartProps> = ({ data = defaultData }) => {
  return (
    <div className="h-[320px] w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#d97706" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000000).toFixed(1)}Tr`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
                    <p className="text-xs font-semibold text-slate-400 mb-1">
                      Khung giờ: {item.name}
                    </p>
                    <p className="text-sm font-bold text-amber-400">
                      Doanh thu: {Number(item.total).toLocaleString('vi-VN')} đ
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Số đơn hoàn tất: <span className="text-white font-semibold">{item.orders}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="total"
            fill="url(#revenueGradient)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
