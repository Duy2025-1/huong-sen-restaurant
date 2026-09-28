import { Router, Request, Response } from 'express';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

// GET /api/reports/dashboard - Tương thích ngược với AdminPage hiện tại, tính toán 100% từ Database
router.get('/dashboard', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const summary = await DashboardService.getSummary();

    // Lấy thêm danh sách giao dịch thanh toán mới nhất
    const recentPayments = await prisma.payment.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: { table: true },
        },
        cashier: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: { select: { code: true, name: true } },
          },
        },
      },
    });

    return res.json({
      revenueToday: summary.revenueToday,
      orderCountToday: summary.orderCountToday,
      totalTables: summary.totalTables,
      occupiedTables: summary.occupiedTables,
      reservedTables: summary.reservedTables,
      cleaningTables: summary.cleaningTables,
      availableTables: summary.availableTables,
      tableOccupancyRate: summary.tableOccupancyRate,
      averagePreparationTime: summary.averagePreparationTime,
      topDishes: summary.topDishes,
      hourlyRevenue: summary.hourlyRevenue,
      recentOrders: summary.recentOrders,
      recentPayments,
    });
  } catch (error) {
    console.error('Error fetching dashboard reports:', error);
    return res.status(500).json({ message: 'Lỗi tải báo cáo thống kê từ cơ sở dữ liệu.' });
  }
});

export default router;
