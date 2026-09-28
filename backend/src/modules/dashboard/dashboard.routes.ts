import { Router, Request, Response } from 'express';
import { DashboardService } from './dashboard.service.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// Tất cả dashboard endpoints yêu cầu quyền Admin hoặc Quản lý
router.use(authenticate, authorize(['admin', 'manager']));

// GET /api/dashboard/summary - Toàn bộ KPI tổng quan (tính từ DB, không fake)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await DashboardService.getSummary();
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error in /dashboard/summary:', error);
    return res.status(500).json({ success: false, error: { message: 'Lỗi tải thống kê dashboard.' } });
  }
});

// GET /api/dashboard/revenue - Doanh thu theo giờ thực tế trong ngày
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const hourly = await DashboardService.getHourlyRevenue();
    return res.json({ success: true, data: hourly });
  } catch (error) {
    console.error('Error in /dashboard/revenue:', error);
    return res.status(500).json({ success: false, error: { message: 'Lỗi tải biểu đồ doanh thu.' } });
  }
});

// GET /api/dashboard/top-dishes - Top món bán chạy nhất từ OrderItem
router.get('/top-dishes', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const topDishes = await DashboardService.getTopDishes(limit);
    return res.json({ success: true, data: topDishes });
  } catch (error) {
    console.error('Error in /dashboard/top-dishes:', error);
    return res.status(500).json({ success: false, error: { message: 'Lỗi tải danh sách món bán chạy.' } });
  }
});

// GET /api/dashboard/recent-orders - Các đơn hàng mới nhất
router.get('/recent-orders', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const orders = await DashboardService.getRecentOrders(limit);
    return res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error in /dashboard/recent-orders:', error);
    return res.status(500).json({ success: false, error: { message: 'Lỗi tải đơn hàng gần đây.' } });
  }
});

// GET /api/dashboard/table-status - Tỷ lệ bàn đang phục vụ
router.get('/table-status', async (req: Request, res: Response) => {
  try {
    const summary = await DashboardService.getSummary();
    return res.json({
      success: true,
      data: {
        totalTables: summary.totalTables,
        occupiedTables: summary.occupiedTables,
        reservedTables: summary.reservedTables,
        cleaningTables: summary.cleaningTables,
        availableTables: summary.availableTables,
        tableOccupancyRate: summary.tableOccupancyRate,
      },
    });
  } catch (error) {
    console.error('Error in /dashboard/table-status:', error);
    return res.status(500).json({ success: false, error: { message: 'Lỗi tải trạng thái bàn.' } });
  }
});

// GET /api/dashboard/kitchen-performance - Tốc độ và SLA chế biến món KDS
router.get('/kitchen-performance', async (req: Request, res: Response) => {
  try {
    const performance = await DashboardService.getKitchenPerformance();
    return res.json({ success: true, data: performance });
  } catch (error) {
    console.error('Error in /dashboard/kitchen-performance:', error);
    return res.status(500).json({ success: false, error: { message: 'Lỗi tải hiệu suất bếp.' } });
  }
});

export default router;
