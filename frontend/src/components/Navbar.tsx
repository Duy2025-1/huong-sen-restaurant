import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Menu as MenuIcon, 
  X, 
  User, 
  LogOut, 
  LogIn, 
  LayoutDashboard, 
  Store, 
  UtensilsCrossed,
  Phone,
  QrCode
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { totalItemCount, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: 'TRANG CHỦ' },
    { to: '/menu', label: 'THỰC ĐƠN' },
    { to: '/#story', label: 'CÂU CHUYỆN', isAnchor: true },
    { to: '/reserve', label: 'ĐẶT BÀN' },
    { to: '/order-lookup', label: 'TRA CỨU ĐƠN' },
    { to: '/#contact', label: 'LIÊN HỆ', isAnchor: true },
  ];

  const handleLinkClick = (link: { to: string; isAnchor?: boolean }) => {
    if (link.isAnchor) {
      if (location.pathname === '/') {
        const id = link.to.replace('/#', '');
        const elem = document.getElementById(id);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
    }
    navigate(link.to);
  };

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-[#FAF7F2]/95 backdrop-blur-md border-b border-wood-900/10 shadow-subtle' 
          : 'bg-[#FAF7F2] border-b border-wood-900/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* 1. BRAND LOGO (LEFT) */}
          <Link to="/" className="flex items-center gap-3 group text-left">
            {/* Elegant Lotus Seal Mark */}
            <div className="w-10 h-10 rounded-soft bg-lotus-800 text-white flex items-center justify-center shadow-subtle transition-transform duration-300 group-hover:scale-105">
              <span className="font-serif font-bold text-xl leading-none tracking-wider">S</span>
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-2xl font-bold tracking-wider text-wood-950 group-hover:text-lotus-800 transition-colors">
                HƯƠNG SEN
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-lotus-800 font-medium -mt-0.5">
                Ẩm Thực Việt Nam
              </span>
            </div>
          </Link>

          {/* 2. NAVIGATION LINKS (CENTER - DESKTOP) */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold tracking-wider text-wood-800">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <button
                  key={item.label}
                  onClick={() => handleLinkClick(item)}
                  className={`transition-colors py-2 relative hover:text-lotus-800 ${
                    isActive ? 'text-lotus-800 font-bold' : 'text-wood-700'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-lotus-800 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 3. ACTIONS (RIGHT: Search, Cart, User) */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Search shortcut button */}
            <button
              onClick={() => navigate('/menu?focus=search')}
              className="p-2.5 rounded-soft text-wood-700 hover:text-lotus-800 hover:bg-wood-100/60 transition-colors"
              title="Tìm kiếm món ăn"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Shopping Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-soft text-wood-700 hover:text-lotus-800 hover:bg-wood-100/60 transition-colors"
              title="Giỏ hàng của bạn"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItemCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-lotus-800 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {totalItemCount}
                </span>
              )}
            </button>

            {/* User Account / Staff Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-soft border border-wood-900/10 text-wood-800 hover:bg-wood-100/60 transition-colors text-xs font-medium"
              >
                <User className="w-4 h-4 text-lotus-800" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {user ? user.fullName || user.email : 'Tài khoản'}
                </span>
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-wood-900/10 rounded-soft shadow-lift py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {user ? (
                    <>
                      <div className="px-4 py-2 border-b border-wood-900/5 mb-1">
                        <p className="text-xs font-bold text-wood-950 truncate">{user.fullName}</p>
                        <p className="text-[11px] text-wood-600 truncate">{user.email}</p>
                        {user.role && (
                          <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-lotus-100 text-lotus-800 px-2 py-0.5 rounded">
                            {user.role}
                          </span>
                        )}
                      </div>

                      {/* Staff Operational Links */}
                      {(user.role === 'admin' || user.role === 'manager' || user.role === 'cashier' || user.role === 'waiter') && (
                        <Link
                          to="/pos"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-wood-800 hover:bg-cream-100 hover:text-lotus-800 transition-colors"
                        >
                          <Store className="w-4 h-4 text-lotus-800" />
                          <span>Màn hình Thu Ngân (POS)</span>
                        </Link>
                      )}

                      {(user.role === 'admin' || user.role === 'manager' || user.role === 'chef') && (
                        <Link
                          to="/kds"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-wood-800 hover:bg-cream-100 hover:text-lotus-800 transition-colors"
                        >
                          <UtensilsCrossed className="w-4 h-4 text-lotus-800" />
                          <span>Màn hình Bếp (KDS)</span>
                        </Link>
                      )}

                      {(user.role === 'admin' || user.role === 'manager') && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-wood-800 hover:bg-cream-100 hover:text-lotus-800 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4 text-lotus-800" />
                          <span>Trang Quản Trị (Admin)</span>
                        </Link>
                      )}

                      <Link
                        to="/table/table-b01-token"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs text-wood-800 hover:bg-cream-100 hover:text-lotus-800 transition-colors"
                      >
                        <QrCode className="w-4 h-4 text-lotus-800" />
                        <span>Xem QR Gọi Món Tại Bàn</span>
                      </Link>

                      <div className="border-t border-wood-900/5 my-1" />

                      <button
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-700 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng Xuất</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-lotus-800 hover:bg-cream-100 transition-colors"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Đăng Nhập / Đăng Ký</span>
                      </Link>
                      <Link
                        to="/table/table-b01-token"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs text-wood-700 hover:bg-cream-100 transition-colors"
                      >
                        <QrCode className="w-4 h-4 text-lotus-800" />
                        <span>Demo Gọi Món Tại Bàn (QR)</span>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-soft text-wood-800 hover:bg-wood-100/60 transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE DRAWER MENU */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-wood-900/10 bg-[#FAF7F2] px-4 pt-4 pb-6 space-y-3 shadow-lift">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  handleLinkClick(item);
                  setIsMobileMenuOpen(false);
                }}
                className="text-left px-3 py-2.5 text-sm font-semibold text-wood-900 hover:text-lotus-800 hover:bg-wood-100/60 rounded-soft transition-colors"
              >
                {item.label}
              </button>
            ))}
            <Link
              to="/table/table-b01-token"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-lotus-800 hover:bg-wood-100/60 rounded-soft transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Dành Cho Khách Tại Quán (Quét QR Bàn)</span>
            </Link>
          </nav>

          <div className="border-t border-wood-900/10 pt-4 flex items-center justify-between text-xs text-wood-600">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-lotus-800" />
              Hotline: 0901.234.567
            </span>
            <span>Mở cửa: 10:00 - 22:30</span>
          </div>
        </div>
      )}
    </header>
  );
};
