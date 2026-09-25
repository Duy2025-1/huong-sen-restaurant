import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// GET /api/payments/bill-preview/:orderId - Lấy phiếu tạm tính để in kiểm tra
// SEC FIX: Enforce staff authorization so arbitrary users cannot probe order billing details
router.get(
  '/bill-preview/:orderId',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId as string);
      if (isNaN(orderId) || orderId <= 0) {
        return res.status(400).json({ message: 'Mã đơn hàng không hợp lệ.' });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          table: { include: { area: true } },
          orderItems: {
            include: {
              dish: true,
              modifiers: true,
            },
          },
          session: true,
        },
      });

      if (!order) return res.status(404).json({ message: 'Không tìm thấy hóa đơn.' });

      return res.json(order);
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi tải phiếu tạm tính.' });
    }
  }
);

// POST /api/payments/settle - Thanh toán chốt hóa đơn & giải phóng bàn
// SEC FIX: Enforce cashier/manager/admin authorization and validate discount amounts against financial tampering
router.post(
  '/settle',
  authenticate,
  authorize(['admin', 'manager', 'cashier']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { orderId, method, discountAmount = 0, note } = req.body;

      const numOrderId = parseInt(orderId);
      if (isNaN(numOrderId) || numOrderId <= 0) {
        return res.status(400).json({ message: 'Mã đơn hàng cần thanh toán không hợp lệ.' });
      }

      const validMethods = ['cash', 'vnpay', 'card', 'transfer', 'vietqr'];
      const finalMethod = typeof method === 'string' && validMethods.includes(method) ? method : 'cash';

      const order = await prisma.order.findUnique({
        where: { id: numOrderId },
        include: { table: true, session: true },
      });

      if (!order) {
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng cần thanh toán.' });
      }

      if (order.status === 'completed' || order.paymentStatus === 'paid') {
        return res.status(400).json({ message: 'Đơn hàng này đã được thanh toán trước đó.' });
      }

      if (order.status === 'cancelled') {
        return res.status(400).json({ message: 'Không thể thanh toán đơn hàng đã bị hủy.' });
      }

      // Security: Discount validation
      const numDiscount = Math.max(0, parseFloat(discountAmount) || 0);
      if (isNaN(numDiscount) || numDiscount < 0) {
        return res.status(400).json({ message: 'Số tiền giảm giá không hợp lệ.' });
      }
      if (numDiscount > order.subtotalAmount) {
        return res.status(400).json({ message: 'Số tiền giảm giá không thể lớn hơn tổng tiền món ăn.' });
      }

      const finalTotal = Math.max(0, order.subtotalAmount - numDiscount);

      // 1. Create Payment Record
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          cashierId: req.user?.id,
          method: finalMethod,
          amount: finalTotal,
          paymentStatus: 'paid',
          transactionCode: `TRANS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          note: note && typeof note === 'string' ? note.slice(0, 255) : null,
        },
      });

      // 2. Complete Order
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentStatus: 'paid',
          discountAmount: numDiscount,
          totalAmount: finalTotal,
        },
      });

      // 3. Close Table Session & set Table status to cleaning
      if (order.sessionId) {
        await prisma.tableSession.update({
          where: { id: order.sessionId },
          data: {
            isActive: false,
            closedAt: new Date(),
          },
        });
      }

      if (order.tableId) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'cleaning' },
        });

        broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
          tableId: order.tableId,
          status: 'cleaning',
        });
      }

      // 4. Emit Payment Completed Event
      broadcastEvent(SocketEvents.PAYMENT_COMPLETED, {
        orderId: order.id,
        orderCode: order.code,
        totalAmount: finalTotal,
        payment,
      });

      return res.json({
        message: 'Thanh toán thành công!',
        payment,
        order: updatedOrder,
      });
    } catch (error) {
      console.error('Error settling payment:', error);
      return res.status(500).json({ message: 'Lỗi trong quá trình thanh toán.' });
    }
  }
);

export default router;
