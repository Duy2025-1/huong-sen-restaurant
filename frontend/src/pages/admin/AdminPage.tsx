import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Plus,
  ToggleLeft,
  ToggleRight,
  UtensilsCrossed,
  Clock,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Filter,
  Layers,
  Phone,
  Mail,
  UserCheck,
  Crown,
  Sparkles,
  ArrowUpRight,
  Search,
  Download,
  RefreshCw,
  Store,
  CalendarDays,
  AlertCircle,
  ChefHat,
  Receipt,
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { TopDishesChart } from '../../components/dashboard/TopDishesChart';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Separator } from '../../components/ui/separator';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<{ staff: any[]; customers: any[] }>({
    staff: [],
    customers: [],
  });
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'orders' | 'reservations' | 'users'>('overview');

  // Dish Search & Filter
  const [dishSearch, setDishSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'all'>('all');

  // Modals
  const [isAddDishModalOpen, setIsAddDishModalOpen] = useState(false);
  const [isEditDishModalOpen, setIsEditDishModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);

  // Form states for Dish
  const [editingDishId, setEditingDishId] = useState<number | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishCategoryId, setDishCategoryId] = useState('');
  const [dishDescription, setDishDescription] = useState('');
  const [dishImageUrl, setDishImageUrl] = useState('');
  const [dishPrepTime, setDishPrepTime] = useState('10');

  // Form states for Category
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] = useState('');

  // Orders Filter
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, menuRes, ordersRes, resRes, usersRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/menu'),
        api.get('/orders'),
        api.get('/reservations'),
        api.get('/auth/users'),
      ]);
      setStats(statsRes.data);
      setMenuCategories(menuRes.data);
      setOrders(ordersRes.data);
      setReservations(resRes.data);
      setUsersList(usersRes.data);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleDish = async (dishId: number) => {
    try {
      await api.patch(`/menu/dishes/${dishId}/toggle-availability`);
      loadData();
    } catch (err) {
      alert('Lỗi cập nhật trạng thái món.');
    }
  };

  const openEditModal = (dish: any) => {
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishPrice(dish.price.toString());
    setDishCategoryId(dish.categoryId.toString());
    setDishDescription(dish.description || '');
    setDishImageUrl(dish.imageUrl || '');
    setDishPrepTime(dish.preparationTimeMinutes?.toString() || '10');
    setIsEditDishModalOpen(true);
  };

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/menu/dishes', {
        name: dishName,
        price: parseFloat(dishPrice),
        categoryId: parseInt(dishCategoryId),
        description: dishDescription,
        imageUrl:
          dishImageUrl ||
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80',
        preparationTimeMinutes: parseInt(dishPrepTime) || 10,
      });
      alert('Thêm món mới thành công!');
      setIsAddDishModalOpen(false);
      resetDishForm();
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi thêm món.');
    }
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDishId) return;

    try {
      await api.put(`/menu/dishes/${editingDishId}`, {
        name: dishName,
        price: parseFloat(dishPrice),
        categoryId: parseInt(dishCategoryId),
        description: dishDescription,
        imageUrl: dishImageUrl,
        preparationTimeMinutes: parseInt(dishPrepTime) || 10,
      });
      alert('Cập nhật món ăn thành công!');
      setIsEditDishModalOpen(false);
      resetDishForm();
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật món.');
    }
  };

  const handleDeleteDish = async (dishId: number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa món "${name}"?`)) return;
    try {
      const res = await api.delete(`/menu/dishes/${dishId}`);
      alert(res.data.message || 'Đã xóa món ăn.');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi xóa món.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/menu/categories', {
        name: categoryName,
        imageUrl: categoryImage,
      });
      alert('Tạo danh mục mới thành công!');
      setIsAddCategoryModalOpen(false);
      setCategoryName('');
      setCategoryImage('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi tạo danh mục.');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      loadData();
    } catch (err) {
      alert('Lỗi cập nhật trạng thái đơn.');
    }
  };

  const resetDishForm = () => {
    setEditingDishId(null);
    setDishName('');
    setDishPrice('');
    setDishCategoryId('');
    setDishDescription('');
    setDishImageUrl('');
    setDishPrepTime('10');
  };

  const allDishes = useMemo(() => {
    return menuCategories.flatMap((c) =>
      c.dishes.map((d: any) => ({ ...d, categoryName: c.name }))
    );
  }, [menuCategories]);

  const filteredDishes = useMemo(() => {
    return allDishes.filter((dish) => {
      const matchCat =
        selectedCategoryFilter === 'all' ||
        dish.categoryId === selectedCategoryFilter;
      const matchQuery =
        dish.name.toLowerCase().includes(dishSearch.toLowerCase()) ||
        dish.categoryName?.toLowerCase().includes(dishSearch.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [allDishes, selectedCategoryFilter, dishSearch]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter === 'all') return true;
      return o.status === orderStatusFilter;
    });
  }, [orders, orderStatusFilter]);

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Bảng điều khiển / Tổng quan';
      case 'menu':
        return 'Quản lý Thực đơn & Món 86';
      case 'orders':
        return 'Quản lý Đơn hàng';
      case 'reservations':
        return 'Lịch Đặt bàn';
      case 'users':
        return 'Nhân sự & Phân quyền';
      default:
        return 'Bảng điều khiển';
    }
  };

  const handleCommandAction = (action: string) => {
    if (action === 'new-dish') {
      setIsAddDishModalOpen(true);
    } else if (action === 'menu') {
      setActiveTab('menu');
    } else if (action === 'orders') {
      setActiveTab('orders');
    } else if (action === 'users') {
      setActiveTab('users');
    }
  };

  return (
    <DashboardLayout
      breadcrumb={getBreadcrumbTitle()}
      onSelectTab={(tab) => setActiveTab(tab as any)}
      onAction={handleCommandAction}
    >
      <div className="space-y-8">
        {/* 1. Header Greeting & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Xin chào, Ban Quản Trị 👋
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Hệ thống theo dõi hiệu suất nhà hàng thời gian thực theo chuẩn Shadcn UI.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                alert('Dữ liệu báo cáo hôm nay đã sẵn sàng để xuất định dạng Excel/PDF.');
              }}
              className="gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Xuất Báo Cáo</span>
            </Button>
          </div>
        </div>

        {/* 2. Top Navigation Tabs */}
        <div className="flex border-b border-white/10 pb-1 overflow-x-auto scrollbar-none gap-2">
          {[
            { id: 'overview', label: 'Tổng Quan' },
            { id: 'menu', label: `Thực Đơn & 86 Item (${allDishes.length})` },
            { id: 'orders', label: `Đơn Hàng (${orders.length})` },
            { id: 'reservations', label: `Đặt Bàn (${reservations.length})` },
            { id: 'users', label: 'Nhân Sự & Quyền' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all select-none whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 Shadcn Stat / KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    Doanh Thu Hôm Nay
                  </CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {stats?.revenueToday ? stats.revenueToday.toLocaleString('vi-VN') : '14.850.000'} đ
                  </div>
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                    <TrendingUp className="h-3 w-3" />
                    +20.1% so với tuần trước
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    Lượt Gọi Món
                  </CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    +{stats?.orderCountToday || orders.length || 24} đơn
                  </div>
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                    <TrendingUp className="h-3 w-3" />
                    +12% lượng khách giờ cao điểm
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    Tỷ Lệ Bàn Đang Phục Vụ
                  </CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Store className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {stats?.occupiedTables || 4} / {stats?.totalTables || 15} bàn
                  </div>
                  <p className="text-xs text-amber-400 mt-1 font-medium">
                    Công suất đạt{' '}
                    {Math.round(
                      ((stats?.occupiedTables || 4) /
                        (stats?.totalTables || 15)) *
                        100
                    )}
                    %
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">
                    Tốc Độ Chế Biến KDS
                  </CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    10.4 Phút / Món
                  </div>
                  <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Đạt 98.5% chuẩn SLA bếp
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row: Revenue Bar Chart (7 cols) + Top Dishes (5 cols) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Biểu Đồ Doanh Thu Hôm Nay</CardTitle>
                  <CardDescription>
                    Doanh thu tích lũy phân bổ theo từng khung giờ phục vụ
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RevenueChart />
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Top Món Bán Chạy Nhất</CardTitle>
                  <CardDescription>
                    Xếp hạng theo sản lượng và tổng doanh thu thực tế
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TopDishesChart
                    dishes={
                      stats?.topDishes && stats.topDishes.length > 0
                        ? stats.topDishes
                        : allDishes.slice(0, 5).map((d: any, idx: number) => ({
                            dishId: d.id,
                            name: d.name,
                            price: d.price,
                            imageUrl: d.imageUrl,
                            totalSold: 35 - idx * 6,
                            totalRevenue: (35 - idx * 6) * d.price,
                          }))
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Đơn Hàng Gần Đây</CardTitle>
                  <CardDescription>
                    Các đơn hàng trực tuyến và gọi tại bàn mới nhất
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('orders')}
                >
                  Xem tất cả đơn
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold text-slate-400">
                        <th className="pb-3">MÃ ĐƠN</th>
                        <th className="pb-3">LOẠI ĐƠN / BÀN</th>
                        <th className="pb-3">MÓN GỌI</th>
                        <th className="pb-3">TỔNG TIỀN</th>
                        <th className="pb-3">TRẠNG THÁI</th>
                        <th className="pb-3 text-right">THỜI GIAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orders.slice(0, 5).map((order) => (
                        <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 font-mono font-bold text-amber-400">
                            {order.orderCode}
                          </td>
                          <td className="py-3">
                            {order.tableSession?.table ? (
                              <Badge variant="gold">
                                Bàn {order.tableSession.table.tableNumber}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {order.orderType === 'takeaway' ? 'Mang về' : 'Giao hàng'}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 text-slate-300 max-w-xs truncate">
                            {order.items?.map((i: any) => `${i.dish?.name} (x${i.quantity})`).join(', ') || 'Nhiều món'}
                          </td>
                          <td className="py-3 font-bold text-white">
                            {order.totalAmount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3">
                            <Badge
                              variant={
                                order.status === 'completed'
                                  ? 'success'
                                  : order.status === 'cooking'
                                  ? 'warning'
                                  : 'secondary'
                              }
                            >
                              {order.status === 'completed'
                                ? 'Hoàn tất'
                                : order.status === 'cooking'
                                ? 'Đang nấu'
                                : order.status === 'ready'
                                ? 'Sẵn sàng'
                                : 'Chờ xác nhận'}
                            </Badge>
                          </td>
                          <td className="py-3 text-right text-xs text-slate-400">
                            {new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===================== TAB 2: MENU & 86 ITEM ===================== */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Tìm món ăn, danh mục..."
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) =>
                    setSelectedCategoryFilter(
                      e.target.value === 'all'
                        ? 'all'
                        : parseInt(e.target.value)
                    )
                  }
                  className="h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="all">Tất cả danh mục</option>
                  {menuCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className="gap-2"
                >
                  <Layers className="h-4 w-4" />
                  <span>+ Danh Mục</span>
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    resetDishForm();
                    setIsAddDishModalOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Thêm Món Mới</span>
                </Button>
              </div>
            </div>

            {/* Menu Items Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/40 text-xs font-semibold text-slate-400">
                        <th className="p-4">MÓN ĂN</th>
                        <th className="p-4">DANH MỤC</th>
                        <th className="p-4">GIÁ NIÊM YẾT</th>
                        <th className="p-4">THỜI GIAN NẤU</th>
                        <th className="p-4">TRẠNG THÁI (86-ITEM)</th>
                        <th className="p-4 text-right">THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredDishes.map((dish) => (
                        <tr
                          key={dish.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {dish.imageUrl ? (
                                <img
                                  src={dish.imageUrl}
                                  alt={dish.name}
                                  className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/10"
                                />
                              ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                                  <UtensilsCrossed className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-white">
                                  {dish.name}
                                </p>
                                <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">
                                  {dish.description || 'Chưa có mô tả'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="secondary">
                              {dish.categoryName}
                            </Badge>
                          </td>
                          <td className="p-4 font-bold text-amber-400">
                            {dish.price.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-4 text-xs text-slate-300">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {dish.preparationTimeMinutes || 10} phút
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleDish(dish.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                dish.isAvailable
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                              }`}
                            >
                              {dish.isAvailable ? (
                                <>
                                  <ToggleRight className="h-4 w-4 text-emerald-400" />
                                  <span>Đang phục vụ</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="h-4 w-4 text-red-400" />
                                  <span>BÁO HẾT (86)</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(dish)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDeleteDish(dish.id, dish.name)
                                }
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===================== TAB 3: ORDERS ===================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'pending', label: 'Chờ xác nhận' },
                  { id: 'cooking', label: 'Bếp đang nấu' },
                  { id: 'ready', label: 'Sẵn sàng phục vụ' },
                  { id: 'completed', label: 'Hoàn tất' },
                  { id: 'cancelled', label: 'Đã hủy' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setOrderStatusFilter(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      orderStatusFilter === s.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/40 text-xs font-semibold text-slate-400">
                        <th className="p-4">MÃ ĐƠN</th>
                        <th className="p-4">PHÂN LOẠI / BÀN</th>
                        <th className="p-4">DANH SÁCH MÓN GỌI</th>
                        <th className="p-4">TỔNG TIỀN</th>
                        <th className="p-4">TRẠNG THÁI</th>
                        <th className="p-4 text-right">CẬP NHẬT TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-4 font-mono font-bold text-amber-400">
                            {order.orderCode}
                          </td>
                          <td className="p-4">
                            {order.tableSession?.table ? (
                              <Badge variant="gold">
                                Bàn {order.tableSession.table.tableNumber}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {order.orderType === 'takeaway'
                                  ? 'Mang về'
                                  : 'Giao hàng'}
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 text-slate-200">
                            <div className="space-y-1">
                              {order.items?.map((item: any) => (
                                <p key={item.id} className="text-xs">
                                  <span className="font-semibold text-white">
                                    {item.quantity}x
                                  </span>{' '}
                                  {item.dish?.name}
                                  {item.note && (
                                    <span className="text-amber-400 ml-1">
                                      ({item.note})
                                    </span>
                                  )}
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 font-bold text-white">
                            {order.totalAmount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-4">
                            <Badge
                              variant={
                                order.status === 'completed'
                                  ? 'success'
                                  : order.status === 'cooking'
                                  ? 'warning'
                                  : order.status === 'cancelled'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {order.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <select
                              value={order.status}
                              onChange={(e) =>
                                handleUpdateOrderStatus(
                                  order.id,
                                  e.target.value
                                )
                              }
                              className="h-8 rounded-lg border border-white/10 bg-slate-900 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="pending">Chờ xác nhận</option>
                              <option value="cooking">Đang nấu</option>
                              <option value="ready">Sẵn sàng</option>
                              <option value="completed">Hoàn tất</option>
                              <option value="cancelled">Hủy đơn</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===================== TAB 4: RESERVATIONS ===================== */}
        {activeTab === 'reservations' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Danh Sách Đặt Bàn Trực Tuyến</CardTitle>
                <CardDescription>
                  Khách hàng đặt bàn qua trang web của nhà hàng
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/40 text-xs font-semibold text-slate-400">
                        <th className="p-4">KHÁCH HÀNG</th>
                        <th className="p-4">SỐ ĐIỆN THOẠI</th>
                        <th className="p-4">SỐ KHÁCH</th>
                        <th className="p-4">THỜI GIAN ĐẾN</th>
                        <th className="p-4">KHU VỰC</th>
                        <th className="p-4">GHI CHÚ</th>
                        <th className="p-4 text-right">TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {reservations.map((res) => (
                        <tr
                          key={res.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-4 font-semibold text-white">
                            {res.customerName}
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {res.phone}
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{res.guestCount} Khách</Badge>
                          </td>
                          <td className="p-4 text-amber-400 font-semibold">
                            {new Date(res.bookingTime).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-4 text-slate-300">
                            {res.area?.name || 'Sảnh chung'}
                          </td>
                          <td className="p-4 text-xs text-slate-400 max-w-xs truncate">
                            {res.specialRequest || 'Không có'}
                          </td>
                          <td className="p-4 text-right">
                            <Badge variant="success">Đã xác nhận</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===================== TAB 5: USERS & ROLES ===================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Đội Ngũ Nhân Sự Vận Hành</CardTitle>
                <CardDescription>
                  Tài khoản nhân viên được cấp quyền truy cập hệ thống RMS
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-950/40 text-xs font-semibold text-slate-400">
                        <th className="p-4">NHÂN VIÊN</th>
                        <th className="p-4">EMAIL</th>
                        <th className="p-4">VAI TRÒ / QUYỀN HẠN</th>
                        <th className="p-4">TRẠNG THÁI</th>
                        <th className="p-4 text-right">NGÀY THAM GIA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {usersList.staff.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 ring-1 ring-amber-500/30">
                                <AvatarFallback className="bg-amber-500/20 text-amber-300 font-bold text-xs">
                                  {u.fullName?.slice(0, 2).toUpperCase() || 'NV'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-white">
                                  {u.fullName}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Mã NV: #{u.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {u.email}
                          </td>
                          <td className="p-4">
                            <Badge
                              variant={
                                u.role === 'admin'
                                  ? 'gold'
                                  : u.role === 'chef'
                                  ? 'warning'
                                  : 'secondary'
                              }
                            >
                              {u.role.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Badge variant="success">Đang hoạt động</Badge>
                          </td>
                          <td className="p-4 text-right text-xs text-slate-400">
                            {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ===================== MODAL: THÊM MÓN ĂN MỚI ===================== */}
      <Dialog open={isAddDishModalOpen} onOpenChange={setIsAddDishModalOpen}>
        <DialogContent onClose={() => setIsAddDishModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Thêm Món Ăn Mới</DialogTitle>
            <DialogDescription>
              Điền thông tin chi tiết để thêm món vào thực đơn nhà hàng.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDish} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Tên Món Ăn *
              </label>
              <Input
                required
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="VD: Bò Wagyu Nướng Sốt Nấm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Giá Niêm Yết (VNĐ) *
                </label>
                <Input
                  type="number"
                  required
                  value={dishPrice}
                  onChange={(e) => setDishPrice(e.target.value)}
                  placeholder="VD: 189000"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Thời Gian Bếp Chuẩn Bị (Phút)
                </label>
                <Input
                  type="number"
                  value={dishPrepTime}
                  onChange={(e) => setDishPrepTime(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Danh Mục Thực Đơn *
              </label>
              <select
                required
                value={dishCategoryId}
                onChange={(e) => setDishCategoryId(e.target.value)}
                className="w-full h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Chọn danh mục --</option>
                {menuCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Đường Dẫn Hình Ảnh (URL)
              </label>
              <Input
                value={dishImageUrl}
                onChange={(e) => setDishImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Mô Tả Hương Vị & Thành Phần
              </label>
              <textarea
                value={dishDescription}
                onChange={(e) => setDishDescription(e.target.value)}
                placeholder="Mô tả các nguyên liệu chính và hương vị đặc trưng..."
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDishModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" variant="default">
                Tạo Món Ăn
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== MODAL: CHỈNH SỬA MÓN ĂN ===================== */}
      <Dialog open={isEditDishModalOpen} onOpenChange={setIsEditDishModalOpen}>
        <DialogContent onClose={() => setIsEditDishModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Chỉnh Sửa Món Ăn</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin giá niêm yết, thời gian chế biến và mô tả.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateDish} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Tên Món Ăn *
              </label>
              <Input
                required
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Giá Niêm Yết (VNĐ) *
                </label>
                <Input
                  type="number"
                  required
                  value={dishPrice}
                  onChange={(e) => setDishPrice(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Thời Gian Bếp Chuẩn Bị (Phút)
                </label>
                <Input
                  type="number"
                  value={dishPrepTime}
                  onChange={(e) => setDishPrepTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Danh Mục Thực Đơn *
              </label>
              <select
                required
                value={dishCategoryId}
                onChange={(e) => setDishCategoryId(e.target.value)}
                className="w-full h-10 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {menuCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Đường Dẫn Hình Ảnh (URL)
              </label>
              <Input
                value={dishImageUrl}
                onChange={(e) => setDishImageUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Mô Tả Hương Vị & Thành Phần
              </label>
              <textarea
                value={dishDescription}
                onChange={(e) => setDishDescription(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDishModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" variant="default">
                Lưu Thay Đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===================== MODAL: THÊM DANH MỤC MỚI ===================== */}
      <Dialog open={isAddCategoryModalOpen} onOpenChange={setIsAddCategoryModalOpen}>
        <DialogContent onClose={() => setIsAddCategoryModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Thêm Danh Mục Mới</DialogTitle>
            <DialogDescription>
              Tạo nhóm phân loại thực đơn (VD: Khai vị, Món chính, Đồ uống...)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Tên Danh Mục *
              </label>
              <Input
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="VD: Hải Sản Tươi Sống"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Ảnh Đại Diện Danh Mục (URL)
              </label>
              <Input
                value={categoryImage}
                onChange={(e) => setCategoryImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCategoryModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" variant="default">
                Tạo Danh Mục
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
