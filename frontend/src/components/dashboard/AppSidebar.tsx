import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  BookOpen,
  CalendarDays,
  Users,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface AppSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  onSelectTab?: (tab: string) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  onSelectTab,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navGroups = [
    {
      groupLabel: 'Tổng quan & Báo cáo',
      items: [
        {
          title: 'Bảng điều khiển',
          icon: LayoutDashboard,
          path: '/admin',
          tab: 'overview',
        },
      ],
    },
    {
      groupLabel: 'Vận hành nhà hàng',
      items: [
        {
          title: 'POS Bán hàng & Bàn',
          icon: Store,
          path: '/pos',
        },
        {
          title: 'Màn hình Bếp (KDS)',
          icon: UtensilsCrossed,
          path: '/kds',
        },
        {
          title: 'Quản lý Đơn hàng',
          icon: ShoppingBag,
          path: '/admin',
          tab: 'orders',
        },
        {
          title: 'Lịch Đặt bàn',
          icon: CalendarDays,
          path: '/reserve',
          external: true,
        },
      ],
    },
    {
      groupLabel: 'Thực đơn & Kho',
      items: [
        {
          title: 'Món ăn & 86 Item',
          icon: BookOpen,
          path: '/admin',
          tab: 'menu',
        },
      ],
    },
    {
      groupLabel: 'Hệ thống',
      items: [
        {
          title: 'Nhân sự & Phân quyền',
          icon: Users,
          path: '/admin',
          tab: 'users',
        },
      ],
    },
  ];

  const handleItemClick = (item: { path: string; tab?: string; external?: boolean }) => {
    if (item.external) {
      window.open(item.path, '_blank');
      return;
    }
    if (item.tab && onSelectTab) {
      onSelectTab(item.tab);
    }
    navigate(item.path);
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Quản trị viên';
      case 'manager':
        return 'Quản lý';
      case 'cashier':
        return 'Thu ngân';
      case 'chef':
        return 'Bếp trưởng';
      case 'waiter':
        return 'Phục vụ';
      default:
        return 'Nhân viên';
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out border-r border-white/10 bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-between ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* 1. Header Brand */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <div
            onClick={() => navigate('/admin')}
            className="flex items-center gap-3 cursor-pointer group overflow-hidden"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lotus-800 text-cream-50 shadow-md group-hover:scale-105 transition-transform font-serif font-bold text-lg">
              S
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-serif font-bold text-base tracking-wide text-white group-hover:text-amber-400 transition-colors truncate">
                  HƯƠNG SEN
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-500/90">
                  Quản Trị Nhà Hàng
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu nhỏ thanh bên'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* 2. Navigation Groups */}
        <div className="p-3 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {navGroups.map((group) => (
            <div key={group.groupLabel} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 select-none">
                  {group.groupLabel}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.title}
                    onClick={() => handleItemClick(item)}
                    title={isCollapsed ? item.title : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 select-none text-left ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm shadow-amber-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-amber-400'
                          : 'text-slate-400 group-hover:text-amber-300'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1">{item.title}</span>
                    )}
                    {!isCollapsed && item.external && (
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-60" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Quick link to Customer Facing Site */}
          <div className="pt-2">
            {!isCollapsed && (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 select-none">
                Giao diện Khách
              </p>
            )}
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              title={isCollapsed ? 'Xem website khách hàng' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-white/5 transition-all ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Website Khách Hàng</span>}
              {!isCollapsed && (
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 ml-auto" />
              )}
            </a>
          </div>
        </div>
      </div>

      {/* 3. Footer User Profile Card */}
      <div className="p-3 border-t border-white/10 bg-slate-900/60">
        <div
          className={`flex items-center gap-3 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-9 w-9 ring-1 ring-amber-500/40">
              <AvatarFallback className="bg-amber-500/20 text-amber-300 font-bold text-xs">
                {user?.fullName?.slice(0, 2).toUpperCase() || 'AD'}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-white truncate">
                  {user?.fullName || 'Quản trị viên'}
                </span>
                <span className="text-[10px] text-amber-400/90 font-medium">
                  {getRoleLabel(user?.role)}
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
