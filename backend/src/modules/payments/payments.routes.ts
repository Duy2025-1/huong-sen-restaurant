import { Router, Request, Response } from 'express';
import { PaymentsService } from './payments.service.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// GET /api/payments/bill-preview/:orderId - Lấy phiếu tạm tính
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

      const order = await PaymentsService.getBillPreview(orderId);
      return res.json(order);
    } catch (error: any) {
      return res.status(404).json({ message: error.message || 'Lỗi tải phiếu tạm tính.' });
    }
  }
);

// POST /api/payments/settle - Thanh toán chốt hóa đơn & giải phóng bàn
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

      const result = await PaymentsService.settleBill({
        orderId: numOrderId,
        method,
        cashierId: req.user?.id,
        discountAmount,
        note,
      });

      return res.json({
        message: 'Thanh toán thành công!',
        payment: result.payment,
        order: result.order,
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Lỗi khi thanh toán đơn hàng.' });
    }
  }
);

export default router;
