import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Phone, User, ShieldCheck, Receipt, ChefHat, UserCheck, Crown, Sparkles } from 'lucide-react';
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
      alert('🎉 Đăng ký tài khoản thành công!');
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
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-dark-950 text-slate-100">
      <div className="glass-card max-w-md w-full rounded-3xl p-6 sm:p-10 shadow-luxury border border-white/10 relative overflow-hidden">
        {/* Glow behind card */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Tab switchers */}
        <div className="flex bg-dark-950 p-1.5 rounded-2xl mb-8 border border-white/10">
          <button
            onClick={() => {
              setMode('customer-login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'customer-login' 
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Đăng Nhập Khách
          </button>
          <button
            onClick={() => {
              setMode('customer-register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'customer-register' 
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Đăng Ký
          </button>
          <button
            onClick={() => {
              setMode('staff');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'staff' 
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nhân Viên
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* 1. CUSTOMER LOGIN */}
        {mode === 'customer-login' && (
          <div>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
                <Crown className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-2xl font-black text-white">Đăng Nhập Thành Viên</h2>
              <p className="text-xs text-slate-400 mt-1 font-light">Tích điểm thưởng và theo dõi đơn hàng dễ dàng</p>
            </div>

            <form onSubmit={handleCustomerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Số điện thoại hoặc Email</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                  <input
                    type="text"
                    required
                    value={custLoginKey}
                    onChange={(e) => setCustLoginKey(e.target.value)}
                    placeholder="0901234567 hoặc email@gmail.com"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                  <input
                    type="password"
                    required
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-orange-500/25 transition disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? 'Đang xác thực...' : 'Đăng Nhập Khách Hàng'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6 font-light">
              Chưa có tài khoản?{' '}
              <button
                onClick={() => setMode('customer-register')}
                className="text-amber-400 font-bold hover:underline"
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
              <h2 className="font-serif text-2xl font-black text-white">Đăng Ký Tài Khoản</h2>
              <p className="text-xs text-slate-400 mt-1 font-light">Nhận ngay ưu đãi thành viên Hương Sen</p>
            </div>

            <form onSubmit={handleCustomerRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Họ và tên *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Số điện thoại *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nguyenvana@gmail.com"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Mật khẩu (ít nhất 6 ký tự) *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-orange-500/25 transition disabled:opacity-50 hover:scale-[1.02] mt-2"
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
              <h2 className="font-serif text-2xl font-black text-white">Vận Hành & Quản Trị</h2>
              <p className="text-xs text-slate-400 mt-1 font-light">Dành cho Admin, Thu ngân, Bếp trưởng & Phục vụ</p>
            </div>

            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Email nhân viên</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="admin@rms.com"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                  <input
                    type="password"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-dark-850 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-orange-500/25 transition disabled:opacity-50 hover:scale-[1.02]"
              >
                {loading ? 'Đang xác thực...' : 'Đăng Nhập Quản Trị'}
              </button>
            </form>

            {/* Quick Demo Buttons */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 text-center mb-3">
                Đăng Nhập Nhanh 1-Chạm (Dành Cho Thuyết Trình)
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@rms.com', '123456', '/admin')}
                  className="p-3 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/10 text-slate-200 text-left transition hover:border-amber-500/40"
                >
                  <p className="font-serif font-bold text-white text-xs">Admin</p>
                  <p className="text-[10px] text-slate-400 truncate">admin@rms.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('cashier@rms.com', '123456', '/pos')}
                  className="p-3 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/10 text-slate-200 text-left transition hover:border-blue-500/40"
                >
                  <p className="font-serif font-bold text-white text-xs">Thu Ngân (POS)</p>
                  <p className="text-[10px] text-slate-400 truncate">cashier@rms.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('chef@rms.com', '123456', '/kds')}
                  className="p-3 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/10 text-slate-200 text-left transition hover:border-emerald-500/40"
                >
                  <p className="font-serif font-bold text-white text-xs">Bếp Trưởng (KDS)</p>
                  <p className="text-[10px] text-slate-400 truncate">chef@rms.com</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('waiter@rms.com', '123456', '/pos')}
                  className="p-3 rounded-2xl bg-dark-850 hover:bg-dark-800 border border-white/10 text-slate-200 text-left transition hover:border-amber-500/40"
                >
                  <p className="font-serif font-bold text-white text-xs">Phục Vụ</p>
                  <p className="text-[10px] text-slate-400 truncate">waiter@rms.com</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
