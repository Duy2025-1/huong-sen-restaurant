import { prisma } from '../../config/prisma.js';

/**
 * Utility to calculate Vietnam Timezone (UTC+7) Date boundaries
 */
export function getVietnamDateRange(targetDate: Date = new Date()) {
  // Convert UTC time to Vietnam local time (UTC+7)
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  const vnTime = new Date(targetDate.getTime() + vnOffsetMs);

  // Start of day in Vietnam
  const vnYear = vnTime.getUTCFullYear();
  const vnMonth = vnTime.getUTCMonth();
  const vnDay = vnTime.getUTCDate();

  // Convert back to UTC boundary
  const startOfDay = new Date(Date.UTC(vnYear, vnMonth, vnDay, 0, 0, 0, 0) - vnOffsetMs);
  const endOfDay = new Date(Date.UTC(vnYear, vnMonth, vnDay, 23, 59, 59, 999) - vnOffsetMs);

  return { startOfDay, endOfDay };
}

export class DashboardService {
  /**
   * 1. GET /api/dashboard/summary
   * TẤT CẢ các chỉ số đều được query trực tiếp từ database thật.
   * KHÔNG fake doanh thu, KHÔNG hard-code fallback số liệu.
   */
  static async getSummary() {
    const { startOfDay, endOfDay } = getVietnamDateRange();

    // 1. Doanh thu hôm nay: CHỈ tính đơn COMPLETED + PAID trong ngày hôm nay
    const completedOrdersToday = await prisma.order.findMany({
      where: {
        status: 'completed',
        paymentStatus: 'paid',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        totalAmount: true,
      },
    });

    const revenueToday = completedOrdersToday.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // 2. Lượt gọi món hôm nay: Tổng số đơn hàng được tạo hôm nay (trừ đơn hủy)
    const orderCountToday = await prisma.order.count({
      where: {
        status: { not: 'cancelled' },
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // 3. Tỷ lệ bàn đang phục vụ: occupiedTables / totalTables
    const totalTables = await prisma.table.count({ where: { isActive: true } });
    const occupiedTables = await prisma.table.count({
      where: { isActive: true, status: 'occupied' },
    });
    const reservedTables = await prisma.table.count({
      where: { isActive: true, status: 'reserved' },
    });
    const cleaningTables = await prisma.table.count({
      where: { isActive: true, status: 'cleaning' },
    });
    const availableTables = await prisma.table.count({
      where: { isActive: true, status: 'available' },
    });

    const tableOccupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;

    // 4. Tốc độ chế biến trung bình KDS: Tính từ cookingAt đến readyAt của các món đã nấu
    // Query các món có cả cookingAt và readyAt
    const cookedItems = await prisma.orderItem.findMany({
      where: {
        cookingAt: { not: null },
        readyAt: { not: null },
        status: { in: ['ready', 'served'] },
      },
      select: {
        cookingAt: true,
        readyAt: true,
      },
      take: 200,
      orderBy: { readyAt: 'desc' },
    });

    let averagePreparationTime: number | null = null;
    if (cookedItems.length > 0) {
      const totalMinutes = cookedItems.reduce((sum, item) => {
        const diffMs = item.readyAt!.getTime() - item.cookingAt!.getTime();
        const minutes = Math.max(1, diffMs / 60000);
        return sum + minutes;
      }, 0);
      averagePreparationTime = Math.round((totalMinutes / cookedItems.length) * 10) / 10;
    }

    // 5. Top 5 món bán chạy nhất từ OrderItem
    const topDishes = await this.getTopDishes(5);

    // 6. Doanh thu theo giờ hôm nay (10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00)
    const hourlyRevenue = await this.getHourlyRevenue();

    // 7. Đơn hàng gần đây
    const recentOrders = await this.getRecentOrders(10);

    return {
      revenueToday,
      orderCountToday,
      totalTables,
      occupiedTables,
      reservedTables,
      cleaningTables,
      availableTables,
      tableOccupancyRate,
      averagePreparationTime, // null nếu chưa có dữ liệu, KHÔNG fake 10.4
      topDishes,
      hourlyRevenue,
      recentOrders,
    };
  }

  /**
   * 2. Doanh thu phân bổ theo khung giờ trong ngày (Asia/Ho_Chi_Minh)
   */
  static async getHourlyRevenue() {
    const { startOfDay, endOfDay } = getVietnamDateRange();

    const orders = await prisma.order.findMany({
      where: {
        status: 'completed',
        paymentStatus: 'paid',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    // Các mốc giờ phục vụ nhà hàng: 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
    const slots = [
      { name: '10:00', startHour: 8, endHour: 10, total: 0, orders: 0 },
      { name: '12:00', startHour: 10, endHour: 12, total: 0, orders: 0 },
      { name: '14:00', startHour: 12, endHour: 14, total: 0, orders: 0 },
      { name: '16:00', startHour: 14, endHour: 16, total: 0, orders: 0 },
      { name: '18:00', startHour: 16, endHour: 18, total: 0, orders: 0 },
      { name: '20:00', startHour: 18, endHour: 20, total: 0, orders: 0 },
      { name: '22:00', startHour: 20, endHour: 23, total: 0, orders: 0 },
    ];

    const vnOffsetMs = 7 * 60 * 60 * 1000;

    for (const order of orders) {
      const vnOrderTime = new Date(order.createdAt.getTime() + vnOffsetMs);
      const hour = vnOrderTime.getUTCHours();

      for (const slot of slots) {
        if (hour >= slot.startHour && hour < slot.endHour) {
          slot.total += order.totalAmount || 0;
          slot.orders += 1;
          break;
        }
      }
    }

    return slots.map((s) => ({
      name: s.name,
      total: s.total,
      orders: s.orders,
    }));
  }

  /**
   * 3. Top món bán chạy nhất từ bảng OrderItem
   */
  static async getTopDishes(limit: number = 5) {
    const bestSellingItems = await prisma.orderItem.groupBy({
      by: ['dishId'],
      where: {
        order: {
          status: 'completed',
        },
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    if (bestSellingItems.length === 0) {
      return [];
    }

    const dishIds = bestSellingItems.map((i) => i.dishId);
    const dishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        category: { select: { name: true } },
      },
    });

    return bestSellingItems.map((item) => {
      const dish = dishes.find((d) => d.id === item.dishId);
      return {
        dishId: item.dishId,
        name: dish?.name || 'Món ăn',
        price: dish?.price || 0,
        imageUrl: dish?.imageUrl || null,
        categoryName: dish?.category?.name || 'Thực đơn',
        totalSold: item._sum.quantity || 0,
        totalRevenue: item._sum.totalPrice || 0,
      };
    });
  }

  /**
   * 4. Danh sách đơn hàng mới nhất
   */
  static async getRecentOrders(limit: number = 10) {
    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
            area: { select: { name: true } },
          },
        },
        orderItems: {
          include: {
            dish: {
              select: { id: true, name: true, price: true, imageUrl: true },
            },
          },
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            paymentStatus: true,
            transactionCode: true,
          },
        },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      code: o.code,
      orderType: o.orderType,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      customerName: o.customerName || (o.table ? `Khách tại ${o.table.tableNumber}` : 'Khách vãng lai'),
      customerPhone: o.customerPhone,
      tableNumber: o.table?.tableNumber || null,
      areaName: o.table?.area?.name || null,
      itemCount: o.orderItems.reduce((acc, item) => acc + item.quantity, 0),
      itemsSummary: o.orderItems.map((i) => `${i.dish.name} (x${i.quantity})`).join(', '),
      createdAt: o.createdAt,
    }));
  }

  /**
   * 5. Hiệu suất chế biến KDS thực tế
   */
  static async getKitchenPerformance() {
    const stations = await prisma.kitchenStation.findMany({
      where: { isActive: true },
      include: {
        orderItems: {
          where: {
            cookingAt: { not: null },
            readyAt: { not: null },
          },
          select: {
            cookingAt: true,
            readyAt: true,
          },
          take: 50,
          orderBy: { readyAt: 'desc' },
        },
      },
    });

    return stations.map((st) => {
      let avgMinutes = 0;
      if (st.orderItems.length > 0) {
        const sumMins = st.orderItems.reduce((sum, item) => {
          const diffMs = item.readyAt!.getTime() - item.cookingAt!.getTime();
          return sum + Math.max(1, diffMs / 60000);
        }, 0);
        avgMinutes = Math.round((sumMins / st.orderItems.length) * 10) / 10;
      }

      return {
        stationId: st.id,
        stationName: st.name,
        completedCount: st.orderItems.length,
        averageMinutes: avgMinutes > 0 ? avgMinutes : null,
      };
    });
  }
}
