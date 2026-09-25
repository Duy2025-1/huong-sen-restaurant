import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { HomePage } from './pages/customer/HomePage';
import { MenuPage } from './pages/customer/MenuPage';
import { ReservationPage } from './pages/customer/ReservationPage';
import { TableOrderPage } from './pages/customer/TableOrderPage';
import { OrderLookupPage } from './pages/customer/OrderLookupPage';
import { PosPage } from './pages/pos/PosPage';
import { KdsPage } from './pages/kds/KdsPage';
import { AdminPage } from './pages/admin/AdminPage';
import { LoginPage } from './pages/auth/LoginPage';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isAdminDashboard = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {!isAdminDashboard && <Navbar />}
      {!isAdminDashboard && <CartDrawer />}
      <main className="flex-1">
        <Routes>
          {/* 1. Customer Public Portal */}
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/reserve" element={<ReservationPage />} />
          <Route path="/order-lookup" element={<OrderLookupPage />} />
          <Route path="/table/:qrToken" element={<TableOrderPage />} />

          {/* 2. Staff Internal Operations (Protected: Staff only) */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier', 'waiter']}>
                <PosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kds"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'chef']}>
                <KdsPage />
              </ProtectedRoute>
            }
          />

          {/* 3. Admin Portal (Protected: Admin & Manager only) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* 4. Authentication */}
          <Route path="/login" element={<LoginPage />} />

          {/* 5. Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
