import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  ShoppingBag, 
  CalendarCheck, 
  QrCode, 
  Radio, 
  LogOut, 
  LogIn, 
  Search, 
  Menu as MenuIcon, 
  X, 
  ShoppingCart,
  Crown,
  MonitorCheck,
  ChefHat,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { socket } from '../services/socket';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { totalItemCount, setIsCartOpen } = useCart();
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: 'Trang Chủ' },
    { to: '/menu', label: 'Thực Đơn' },
    { to: '/table/table-b01-token', label: 'Quét QR Bàn', icon: QrCode },
    { to: '/reserve', label: 'Đặt Bàn' },
    { to: '/order-lookup', label: 'Tra Cứu' },
    { to: '/pos', label: 'POS Thu Ngân', badge: 'Thu Ngân' },
    { to: '/kds', label: 'Bếp KDS', badge: 'Bếp' },
    { to: '/admin', label: 'Quản Trị', badge: 'Admin' },
  ];

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-dark-950/85 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/50' 
          : 'bg-dark-950/60 backdrop-blur-md border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-700 p-0.5 shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-300">
                <div className="w-full h-full bg-dark-950 rounded-[14px] flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-dark-950" />
            </div>
            <div>
              <span className="font-serif font-black text-xl tracking-wider gold-gradient-text block">
                HƯƠNG SEN
              </span>
              <span className="text-[9px] font-bold text-slate-400 tracking-[0.25em] uppercase block -mt-0.5">
                Grand Dining & RMS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 bg-dark-900/80 p-1.5 rounded-2xl border border-white/10 shadow-inner">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-600/30 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.icon && <link.icon className="w-3.5 h-3.5" />}
                  <span>{link.label}</span>
                  {link.badge && !isActive && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/10 text-slate-400 font-medium">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status, Cart & Auth */}
          <div className="flex items-center gap-2.5">
            {/* Realtime Live Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-dark-900 border border-white/10 shadow-inner">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-glow-emerald animate-pulse' : 'bg-rose-500'}`} />
              <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {isConnected ? 'Real-time Live' : 'Offline'}
              </span>
            </div>

            {/* Shopping Cart Floating Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/10 text-slate-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg group"
              title="Xem Giỏ Hàng"
            >
              <ShoppingCart className="w-4 h-4 text-amber-400 group-hover:text-amber-300 transition-colors" />
              {totalItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[10px] flex items-center justify-center shadow-lg shadow-orange-600/50 animate-bounce">
                  {totalItemCount}
                </span>
              )}
            </button>

            {/* User Profile or Login */}
            {user ? (
              <div className="flex items-center gap-2 bg-dark-850 border border-white/10 rounded-2xl p-1.5 pl-3">
                <div className="text-right hidden md:block">
                  <p className="text-xs font-bold text-slate-100 truncate max-w-[110px]">{user.fullName}</p>
                  <p className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider">{user.roleName}</p>
                </div>
                <button
                  onClick={logout}
                  title="Đăng xuất"
                  className="p-2 rounded-xl bg-dark-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-white/5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 hover:-translate-y-0.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng Nhập</span>
              </Link>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2.5 rounded-2xl bg-dark-850 border border-white/10 text-slate-300 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="xl:hidden py-4 border-t border-white/10 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition ${
                    isActive 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-600/30' 
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
