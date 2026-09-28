import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { OrdersService } from './orders.service.js';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// Rate limiter for public order lookup
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu tra cứu đơn hàng. Vui lòng thử lại sau.' },
});

// Rate limiter for bill call requests
const billRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Yêu cầu tính tiền đã được gửi. Vui lòng chờ nhân viên thu ngân.' },
});

// 1. POST /api/orders/dine-in - Gọi món tại bàn (Dành cho Khách quét QR & Phục vụ)
router.post('/dine-in', async (req: Request, res: Response) => {
  try {
    const { tableId, qrToken, items, note, customerName, customerPhone, idempotencyKey } = req.body;

    const result = await OrdersService.createDineInOrder({
      tableId: tableId ? parseInt(tableId) : undefined,
      qrToken: typeof qrToken === 'string' ? qrToken : undefined,
      items,
      note,
      customerName,
      customerPhone,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
    });

    return res.status(201).json({
      message: result.isDuplicate ? 'Đơn hàng đã tồn tại (Idempotent response)' : 'Gọi món thành công!',
      order: result.order,
      roundNumber: result.roundNumber,
      newItems: result.newItems,
    });
  } catch (error: any) {
    console.error('Error in createDineInOrder:', error);
    return res.status(400).json({ message: error.message || 'Lỗi khi gọi món tại bàn.' });
  }
});

// 2. POST /api/orders/delivery - Đặt món giao hàng / mang về trực tiếp từ Web Cart
router.post('/delivery', async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, deliveryAddress, orderType, paymentMethod, items, note, promoCode, idempotencyKey } = req.body;

    const result = await OrdersService.createDeliveryOrder({
      customerName,
      customerPhone,
      deliveryAddress,
      orderType: orderType === 'takeout' ? 'takeout' : 'delivery',
      paymentMethod: paymentMethod || 'cod',
      items,
      note,
      promoCode,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
    });

    return res.status(201).json({
      message: result.isDuplicate ? 'Đơn hàng đã tồn tại (Idempotent response)' : 'Đặt đơn hàng thành công!',
      order: result.order,
    });
  } catch (error: any) {
    console.error('Error in createDeliveryOrder:', error);
    return res.status(400).json({ message: error.message || 'Lỗi khi đặt đơn giao hàng.' });
  }
});

// 3. GET /api/orders - Quản lý tất cả đơn hàng (Admin & Staff)
router.get(
  '/',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter', 'chef']),
  async (req: Request, res: Response) => {
    try {
      const { status, orderType } = req.query;
      const whereClause: any = {};

      if (status && status !== 'all' && typeof status === 'string') {
        whereClause.status = status;
      }
      if (orderType && orderType !== 'all' && typeof orderType === 'string') {
        whereClause.orderType = orderType;
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          table: { include: { area: true } },
          session: true,
          orderItems: {
            include: { dish: true, modifiers: true },
          },
          payments: true,
          statusHistories: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        take: 200,
      });

      return res.json(orders);
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi lấy danh sách đơn hàng.' });
    }
  }
);

// 4. GET /api/orders/active - Lấy danh sách các đơn đang hoạt động (POS)
router.get(
  '/active',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter', 'chef']),
  async (req: Request, res: Response) => {
    try {
      const orders = await prisma.order.findMany({
        where: {
          status: { notIn: ['completed', 'cancelled', 'refunded'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          table: { include: { area: true } },
          session: true,
          orderItems: {
            include: { dish: true, modifiers: true },
          },
        },
      });

      return res.json(orders);
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi lấy danh sách đơn active.' });
    }
  }
);

// 5. PATCH /api/orders/:id/status - Cập nhật trạng thái đơn hàng có kiểm tra transition logic
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId) || orderId <= 0) {
        return res.status(400).json({ message: 'Mã đơn hàng không hợp lệ.' });
      }

      const { status, reason } = req.body;
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: 'Trạng thái chuyển tiếp không hợp lệ.' });
      }

      const updated = await OrdersService.updateOrderStatus(orderId, status, req.user?.id, reason);

      return res.json({ message: 'Cập nhật trạng thái đơn thành công!', order: updated });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Lỗi cập nhật trạng thái đơn hàng.' });
    }
  }
);

// 6. GET /api/orders/lookup/:query - Khách tra cứu thông tin đơn hàng theo SĐT hoặc Mã đơn
router.get('/lookup/:query', lookupLimiter, async (req: Request, res: Response) => {
  try {
    const rawQuery = (req.params.query as string || '').trim();
    if (!rawQuery || rawQuery.length < 3 || rawQuery.length > 50) {
      return res.status(400).json({ message: 'Từ khóa tra cứu không hợp lệ (từ 3 đến 50 ký tự).' });
    }

    const orders = await OrdersService.lookupOrder(rawQuery);
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tra cứu đơn hàng.' });
  }
});

// 7. POST /api/orders/:id/request-bill - Khách bấm yêu cầu thanh toán trên Mobile
router.post('/:id/request-bill', billRequestLimiter, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id as string);
    if (isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Mã đơn hàng không hợp lệ.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });

    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ message: 'Đơn hàng này đã hoàn tất hoặc đã hủy.' });
    }

    broadcastEvent(SocketEvents.BILL_REQUESTED, {
      orderId: order.id,
      orderCode: order.code,
      tableNumber: order.table?.tableNumber || 'Bàn không xác định',
      totalAmount: order.totalAmount,
    });

    return res.json({ message: 'Đã gửi yêu cầu thanh toán đến quầy Thu ngân!' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi gửi yêu cầu thanh toán.' });
  }
});

export default router;
