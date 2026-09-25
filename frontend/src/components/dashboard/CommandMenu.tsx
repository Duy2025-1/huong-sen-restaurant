import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  UtensilsCrossed,
  Store,
  ShoppingBag,
  Users,
  PlusCircle,
  ExternalLink,
  BookOpen,
  CalendarDays,
  Sparkles,
  X,
} from 'lucide-react';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: string) => void;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  open,
  onOpenChange,
  onAction,
}) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const items = [
    {
      category: 'Điều hướng nhanh',
      list: [
        {
          id: 'nav-dashboard',
          title: 'Tổng quan Dashboard & Doanh thu',
          icon: LayoutDashboard,
          action: () => {
            navigate('/admin');
            onOpenChange(false);
          },
        },
        {
          id: 'nav-pos',
          title: 'POS - Bán hàng & Sơ đồ bàn ăn',
          icon: Store,
          action: () => {
            navigate('/pos');
            onOpenChange(false);
          },
        },
        {
          id: 'nav-kds',
          title: 'KDS - Màn hình điều phối Bếp thời gian thực',
          icon: UtensilsCrossed,
          action: () => {
            navigate('/kds');
            onOpenChange(false);
          },
        },
        {
          id: 'nav-orders',
          title: 'Quản lý Đơn hàng & Lịch sử thanh toán',
          icon: ShoppingBag,
          action: () => {
            navigate('/admin');
            onAction?.('orders');
            onOpenChange(false);
          },
        },
        {
          id: 'nav-menu',
          title: 'Quản lý Thực đơn & Món ăn 86-Item',
          icon: BookOpen,
          action: () => {
            navigate('/admin');
            onAction?.('menu');
            onOpenChange(false);
          },
        },
        {
          id: 'nav-users',
          title: 'Quản lý Nhân viên & Phân quyền tài khoản',
          icon: Users,
          action: () => {
            navigate('/admin');
            onAction?.('users');
            onOpenChange(false);
          },
        },
      ],
    },
    {
      category: 'Thao tác nhanh',
      list: [
        {
          id: 'act-new-dish',
          title: 'Thêm món ăn mới vào thực đơn',
          icon: PlusCircle,
          action: () => {
            navigate('/admin');
            onAction?.('new-dish');
            onOpenChange(false);
          },
        },
        {
          id: 'act-open-customer',
          title: 'Mở Trang khách hàng (Landing Page)',
          icon: ExternalLink,
          action: () => {
            window.open('/', '_blank');
            onOpenChange(false);
          },
        },
        {
          id: 'act-open-menu',
          title: 'Mở Menu Khách hàng trực tuyến',
          icon: ExternalLink,
          action: () => {
            window.open('/menu', '_blank');
            onOpenChange(false);
          },
        },
        {
          id: 'act-open-reserve',
          title: 'Mở Trang Đặt bàn trực tuyến',
          icon: CalendarDays,
          action: () => {
            window.open('/reserve', '_blank');
            onOpenChange(false);
          },
        },
      ],
    },
  ];

  const filtered = items
    .map((grp) => ({
      category: grp.category,
      list: grp.list.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter((grp) => grp.list.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/95 p-0 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200 overflow-hidden text-slate-100">
        {/* Search Input Box */}
        <div className="flex items-center px-4 border-b border-white/10">
          <Search className="h-5 w-5 text-amber-400 shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm chức năng, trang, món ăn... (Gõ để tìm)"
            className="h-14 w-full bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 border border-white/10 ml-2">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Không tìm thấy lệnh hoặc chức năng phù hợp với "{query}".
            </div>
          ) : (
            filtered.map((grp) => (
              <div key={grp.category} className="space-y-1">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {grp.category}
                </div>
                {grp.list.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-amber-500/10 hover:text-amber-300 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-white/5 group-hover:bg-amber-500/20 group-hover:border-amber-500/30 text-slate-300 group-hover:text-amber-400 transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <Sparkles className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-t border-white/5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>Dùng phím mũi tên để chọn</span>
            <span>•</span>
            <span>Enter để thực thi</span>
          </div>
          <span className="text-amber-400/80 font-medium">Shadcn Command Palette</span>
        </div>
      </div>
    </div>
  );
};
