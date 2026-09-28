import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'customer-login' | 'customer-register' | 'staff'>('customer-login');

  // Customer Form
  const [custLoginKey, setCustLoginKey] = useState('');
  const [custPassword, setCustPassword] = useState('');

  // Register Form
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Staff Form
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/customer-login', {
        loginKey: custLoginKey,
        password: custPassword,
      });

      localStorage.setItem('rms_token', res.data.token);
      window.location.href = '/';
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/register', {
        fullName: regFullName,
        phone: regPhone,
        email: regEmail,
        password: regPassword,
      });

      localStorage.setItem('rms_token', res.data.token);
      alert('🎉 Đăng ký tài khoản Hương Sen thành công!');
      window.location.href = '/';
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const success = await login(staffEmail, staffPassword);
    setLoading(false);
    if (success) {
      navigate('/pos');
    }
  };

  const handleQuickLogin = async (email: string, pass: string, redirect: string) => {
    setLoading(true);
    const success = await login(email, pass);
    setLoading(false);
    if (success) {
      navigate(redirect);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-cream-50 text-wood-900 font-sans">
      <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-10 shadow-lift border border-wood-200 relative overflow-hidden">
        {/* Subtle lotus ornament */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-lotus-800 text-cream-50 flex items-center justify-center mx-auto mb-3 shadow-subtle">
            <span className="font-serif font-bold text-2xl">S</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-ochre-700 block">
            Hương Sen • Ẩm Thực Thuần Việt
          </span>
          <p className="text-xs text-wood-500 font-serif italic mt-0.5">
            Trọn vị Việt, gìn giữ hương quê
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-cream-100 p-1 rounded-xl mb-6 border border-wood-200">
          <button
            onClick={() => {
              setMode('customer-login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'customer-login' 
                ? 'bg-lotus-800 text-cream-50 shadow-sm' 
                : 'text-wood-600 hover:text-wood-900'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => {
              setMode('customer-register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'customer-register' 
                ? 'bg-lotus-800 text-cream-50 shadow-sm' 
                : 'text-wood-600 hover:text-wood-900'
            }`}
          >
            Đăng Ký
          </button>
          <button
            onClick={() => {
              setMode('staff');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'staff' 
                ? 'bg-lotus-800 text-cream-50 shadow-sm' 
                : 'text-wood-600 hover:text-wood-900'
            }`}
          >
            Nhân Viên
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-terracotta/10 border border-terracotta/30 text-terracotta text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* 1. CUSTOMER LOGIN */}
        {mode === 'customer-login' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-lotus-900">Đăng Nhập Thành Viên</h2>
              <p className="text-xs text-wood-600 mt-1 font-serif">Tích lũy điểm thưởng và theo dõi bữa ăn thân thuộc</p>
            </div>

            <form onSubmit={handleCustomerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Số điện thoại hoặc Email</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    value={custLoginKey}
                    onChange={(e) => setCustLoginKey(e.target.value)}
                    placeholder="0901234567 hoặc email@gmail.com"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="password"
                    required
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs rounded-xl shadow-subtle transition disabled:opacity-50 active:scale-98"
              >
                {loading ? 'Đang xác thực...' : 'Đăng Nhập Khách Hàng'}
              </button>
            </form>

            <p className="text-center text-xs text-wood-600 mt-5">
              Chưa có tài khoản?{' '}
              <button
                onClick={() => setMode('customer-register')}
                className="text-lotus-800 font-bold hover:underline"
              >
                Đăng ký ngay
              </button>
            </p>
          </div>
        )}

        {/* 2. CUSTOMER REGISTER */}
        {mode === 'customer-register' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-lotus-900">Đăng Ký Tài Khoản</h2>
              <p className="text-xs text-wood-600 mt-1 font-serif">Trở thành thành viên thân thiết Hương Sen</p>
            </div>

            <form onSubmit={handleCustomerRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Họ và tên *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-wood-400 absolute left-4 top-3" />
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Số điện thoại *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-wood-400 absolute left-4 top-3" />
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Email (tùy chọn)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-wood-400 absolute left-4 top-3" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nguyenvana@gmail.com"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Mật khẩu (ít nhất 6 ký tự) *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-wood-400 absolute left-4 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs rounded-xl shadow-subtle transition disabled:opacity-50 active:scale-98 mt-2"
              >
                {loading ? 'Đang tạo tài khoản...' : 'Tạo Tài Khoản Thành Viên'}
              </button>
            </form>
          </div>
        )}

        {/* 3. STAFF & ADMIN LOGIN */}
        {mode === 'staff' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-lotus-900">Vận Hành & Quản Trị</h2>
              <p className="text-xs text-wood-600 mt-1 font-serif">Dành cho Admin, Thu ngân, Bếp trưởng & Phục vụ</p>
            </div>

            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Email nội bộ</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="admin@rms.com"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-wood-800 mb-1">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-wood-400 absolute left-4 top-3.5" />
                  <input
                    type="password"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-cream-50 border border-wood-200 rounded-xl pl-11 pr-4 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 shadow-subtle"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-lotus-800 hover:bg-lotus-900 text-cream-50 font-bold text-xs rounded-xl shadow-subtle transition disabled:opacity-50 active:scale-98"
              >
                {loading ? 'Đang xác thực...' : 'Đăng Nhập Quản Trị'}
              </button>
            </form>

            {/* Quick Demo Buttons */}
            <div className="mt-6 pt-5 border-t border-wood-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ochre-700 text-center mb-2.5">
                Đăng Nhập Nhanh 1-Chạm (Dành Cho Giảng Viên & Test Chức Năng)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@rms.com', '123456', '/admin')}
                  className="p-2.5 rounded-xl bg-cream-50 hover:bg-cream-100 border border-wood-200 text-left transition hover:border-lotus-400 shadow-subtle"
                >
                  <p className="font-serif font-bold text-lotus-900 text-xs">Quản Trị Viên (Admin)</p>
                  <p className="text-[10px] text-wood-500 truncate">admin@rms.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('cashier@rms.com', '123456', '/pos')}
                  className="p-2.5 rounded-xl bg-cream-50 hover:bg-cream-100 border border-wood-200 text-left transition hover:border-lotus-400 shadow-subtle"
                >
                  <p className="font-serif font-bold text-lotus-900 text-xs">Thu Ngân (POS)</p>
                  <p className="text-[10px] text-wood-500 truncate">cashier@rms.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('chef@rms.com', '123456', '/kds')}
                  className="p-2.5 rounded-xl bg-cream-50 hover:bg-cream-100 border border-wood-200 text-left transition hover:border-lotus-400 shadow-subtle"
                >
                  <p className="font-serif font-bold text-lotus-900 text-xs">Bếp Trưởng (KDS)</p>
                  <p className="text-[10px] text-wood-500 truncate">chef@rms.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('waiter@rms.com', '123456', '/pos')}
                  className="p-2.5 rounded-xl bg-cream-50 hover:bg-cream-100 border border-wood-200 text-left transition hover:border-lotus-400 shadow-subtle"
                >
                  <p className="font-serif font-bold text-lotus-900 text-xs">Phục Vụ Bàn</p>
                  <p className="text-[10px] text-wood-500 truncate">waiter@rms.com</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default LoginPage;
