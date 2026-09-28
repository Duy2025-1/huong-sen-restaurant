import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { AuditService } from '../audit/audit.service.js';

export interface SettleBillInput {
  orderId: number;
  method?: string;
  cashierId?: number | null;
  discountAmount?: number;
  note?: string;
}

export class PaymentsService {
  /**
   * Xem trước hóa đơn tạm tính cho khách/nhân viên
   */
  static async getBillPreview(orderId: number) {
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
        payments: true,
      },
    });

    if (!order) {
      throw new Error('Không tìm thấy đơn hàng cần tính tiền.');
    }

    return order;
  }

  /**
   * Thanh toán hóa đơn an toàn (ACID transaction)
   * Chống thanh toán lại, chống discount giả, tự động đóng session và chuyển trạng thái bàn.
   */
  static async settleBill(input: SettleBillInput) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { table: true, session: true },
      });

      if (!order) {
        throw new Error('Đơn hàng không tồn tại.');
      }

      if (order.status === 'completed' || order.paymentStatus === 'paid') {
        throw new Error('Đơn hàng này đã được thanh toán hoàn tất trước đó.');
      }

      if (order.status === 'cancelled') {
        throw new Error('Không thể thanh toán đơn hàng đã bị hủy.');
      }

      // Kiểm tra và validate giảm giá chống gian lận
      const numDiscount = Math.max(0, parseFloat(input.discountAmount as any) || 0);
      if (numDiscount > order.subtotalAmount) {
        throw new Error('Số tiền giảm giá không thể lớn hơn tổng tiền món ăn.');
      }

      const finalTotal = Math.max(0, order.subtotalAmount - numDiscount + order.deliveryFee);
      const validMethods = ['cash', 'vnpay', 'vietqr', 'card', 'transfer', 'momo'];
      const finalMethod = input.method && validMethods.includes(input.method) ? input.method : 'cash';

      const transCode = `TRANS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Tạo bản ghi thanh toán (Payment)
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          cashierId: input.cashierId || null,
          method: finalMethod,
          amount: finalTotal,
          paymentStatus: 'paid',
          transactionCode: transCode,
          note: input.note ? input.note.slice(0, 255) : null,
        },
      });

      // 2. Tạo bản ghi lịch sử giao dịch (PaymentTransaction)
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          provider: finalMethod.toUpperCase(),
          transactionId: transCode,
          amount: finalTotal,
          status: 'SUCCESS',
        },
      });

      // 3. Hoàn tất đơn hàng (Order)
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentStatus: 'paid',
          discountAmount: numDiscount,
          totalAmount: finalTotal,
        },
      });

      // 4. Ghi lịch sử trạng thái đơn
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'completed',
          changedById: input.cashierId || null,
          reason: `Thu ngân chốt thanh toán (${finalMethod.toUpperCase()})`,
        },
      });

      // 5. Đóng phiên bàn ăn (TableSession) nếu là đơn tại bàn
      if (order.sessionId) {
        await tx.tableSession.update({
          where: { id: order.sessionId },
          data: {
            isActive: false,
            status: 'closed',
            closedAt: new Date(),
          },
        });
      }

      // 6. Chuyển bàn sang trạng thái "cleaning" (chờ dọn)
      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'cleaning' },
        });

        broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
          tableId: order.tableId,
          status: 'cleaning',
        });
      }

      // 7. Ghi Audit Log cho giao dịch tài chính
      await AuditService.log({
        staffId: input.cashierId,
        action: 'SETTLE_PAYMENT',
        entity: 'Order',
        entityId: order.id,
        oldValue: { status: order.status, paymentStatus: order.paymentStatus },
        newValue: {
          status: 'completed',
          paymentStatus: 'paid',
          amount: finalTotal,
          method: finalMethod,
        },
      });

      // 8. Phát sự kiện WebSocket
      broadcastEvent(SocketEvents.PAYMENT_COMPLETED, {
        orderId: order.id,
        orderCode: order.code,
        totalAmount: finalTotal,
        payment,
      });

      return { payment, order: updatedOrder };
    });
  }
}
