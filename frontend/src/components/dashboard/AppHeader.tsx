import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  onOpenCommand: () => void;
  currentBreadcrumb?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenMobileMenu,
  onOpenCommand,
  currentBreadcrumb = 'Bảng điều khiển',
}) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Mock live notifications from POS / KDS
  const notifications = [
    {
      id: 1,
      title: 'Bàn VIP 01 yêu cầu tính tiền',
      time: '2 phút trước',
      type: 'payment',
      icon: Receipt,
      read: false,
    },
    {
      id: 2,
      title: 'Bếp hoàn tất món: Tôm Sú Nướng',
      time: '5 phút trước',
      type: 'kds',
      icon: CheckCircle2,
      read: false,
    },
    {
      id: 3,
      title: 'Món Bò Lúc Lắc sắp hết nguyên liệu',
      time: '18 phút trước',
      type: 'stock',
      icon: AlertTriangle,
      read: true,
    },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 sm:px-6 backdrop-blur-xl">
      {/* 1. Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-medium">
          <span className="hidden sm:inline hover:text-slate-200 cursor-pointer">
            Hệ Thống RMS
          </span>
          <span className="hidden sm:inline text-slate-600">/</span>
          <span className="text-amber-400 font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            {currentBreadcrumb}
          </span>
        </div>
      </div>

      {/* 2. Middle: Search Trigger (Command Palette) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-400 hover:border-amber-500/40 hover:text-slate-200 transition-all shadow-inner w-36 sm:w-64 justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Tìm kiếm...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-white/10">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Real-time Socket Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
          <Wifi className="h-3 w-3 animate-pulse" />
          <span>Live Socket.io</span>
        </div>

        {/* 3. Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-xl border border-white/10 bg-slate-900/80 text-slate-300 hover:text-white hover:border-amber-500/30 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-slate-950 animate-pulse" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-150 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 px-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Thông báo trực tiếp
                </span>
                <Badge variant="gold" className="text-[10px] px-1.5 py-0">
                  2 Mới
                </Badge>
              </div>
              <div className="divide-y divide-white/5 py-1">
                {notifications.map((n) => {
                  const Icon = n.icon;
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-slate-800 text-amber-400 shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200">
                          {n.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {n.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl border border-white/10 bg-slate-900/80 hover:border-amber-500/30 transition-all"
          >
            <Avatar className="h-7 w-7 ring-1 ring-amber-500/30">
              <AvatarFallback className="bg-amber-500/20 text-amber-300 font-bold text-[11px]">
                {user?.fullName?.slice(0, 2).toUpperCase() || 'AD'}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-xs font-semibold text-slate-200 max-w-[100px] truncate">
              {user?.fullName || 'Admin'}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-150 z-50">
              <div className="px-3 py-2 border-b border-white/10 mb-1">
                <p className="text-xs font-bold text-white truncate">
                  {user?.fullName || 'Quản trị viên'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'admin@rms.com'}
                </p>
              </div>
              <button
                onClick={() => {
                  window.open('/', '_blank');
                  setShowUserMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Xem Website Khách</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  setShowUserMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
