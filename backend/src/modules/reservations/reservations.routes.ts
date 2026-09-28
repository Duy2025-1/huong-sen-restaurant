import { Router, Request, Response } from 'express';
import { ReservationsService } from './reservations.service.js';
import { prisma } from '../../config/prisma.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// POST /api/reservations - Đặt bàn trước (Khách đặt online hoặc Lễ tân nhập)
router.post('/', async (req: Request, res: Response) => {
  try {
    const reservation = await ReservationsService.createReservation(req.body);
    return res.status(201).json({
      message: 'Đặt bàn thành công! Nhà hàng Hương Sen sẽ liên hệ xác nhận sớm nhất.',
      reservation,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Lỗi khi đặt bàn.' });
  }
});

// GET /api/reservations - Lấy danh sách đặt bàn (Admin / Quản lý)
router.get(
  '/',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const where: any = {};
      if (status && status !== 'all' && typeof status === 'string') {
        where.status = status;
      }

      const reservations = await prisma.reservation.findMany({
        where,
        orderBy: { reservationTime: 'asc' },
        include: {
          table: { include: { area: true } },
          customer: true,
        },
        take: 100,
      });

      return res.json(reservations);
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi lấy danh sách đặt bàn.' });
    }
  }
);

// PATCH /api/reservations/:id/status - Cập nhật trạng thái đặt bàn
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: 'Mã đặt bàn không hợp lệ.' });
      }

      const { status } = req.body;
      const updated = await ReservationsService.updateStatus(id, status, req.user?.id);
      return res.json({ message: 'Cập nhật trạng thái đặt bàn thành công!', reservation: updated });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Lỗi cập nhật trạng thái đặt bàn.' });
    }
  }
);

export default router;
