import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// GET /api/reports/dashboard - Tổng quan báo cáo kinh doanh cho Admin
router.get('/dashboard', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Total revenue & orders today
    const completedOrdersToday = await prisma.order.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: startOfToday },
      },
    });

    const revenueToday = completedOrdersToday.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCountToday = completedOrdersToday.length;

    // 2. Table status count
    const totalTables = await prisma.table.count({ where: { isActive: true } });
    const occupiedTables = await prisma.table.count({
      where: { isActive: true, status: 'occupied' },
    });

    // 3. Top selling dishes
    const bestSellingItems = await prisma.orderItem.groupBy({
      by: ['dishId'],
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const dishDetails = await prisma.dish.findMany({
      where: {
        id: { in: bestSellingItems.map((i) => i.dishId) },
      },
    });

    const topDishes = bestSellingItems.map((item) => {
      const dish = dishDetails.find((d) => d.id === item.dishId);
      return {
        dishId: item.dishId,
        name: dish?.name || 'Món không xác định',
        price: dish?.price || 0,
        imageUrl: dish?.imageUrl,
        totalSold: item._sum.quantity || 0,
        totalRevenue: item._sum.totalPrice || 0,
      };
    });

    // 4. Recent transactions
    // SEC FIX: Explicitly select safe cashier fields, preventing bcrypt passwordHash leakage in JSON responses
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
            roleId: true,
          },
        },
      },
    });

    return res.json({
      revenueToday,
      orderCountToday,
      totalTables,
      occupiedTables,
      topDishes,
      recentPayments,
    });
  } catch (error) {
    console.error('Error fetching dashboard reports:', error);
    return res.status(500).json({ message: 'Lỗi tải báo cáo thống kê.' });
  }
});

export default router;
