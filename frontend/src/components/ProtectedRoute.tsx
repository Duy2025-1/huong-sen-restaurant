import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        Đang xác thực quyền truy cập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-100">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-200 shadow-xl">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Truy Cập Bị Từ Chối (403)</h2>
          <p className="text-xs text-slate-500 mt-2">
            Tài khoản của bạn (<strong className="text-slate-800">{user.roleName}</strong>) không có quyền truy cập vào phân hệ này.
          </p>
          <a
            href="/"
            className="mt-6 inline-block w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold shadow hover:bg-slate-800 transition"
          >
            Quay Về Trang Chủ
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
