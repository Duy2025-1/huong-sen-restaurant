import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// POST /api/reservations - Đặt bàn trước (Khách đặt online hoặc Lễ tân nhập)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { branchId, customerName, customerPhone, guestCount, reservationTime, note, depositAmount } = req.body;

    // Strict input validation
    if (!customerName || typeof customerName !== 'string' || !customerName.trim() || customerName.trim().length > 100) {
      return res.status(400).json({ message: 'Vui lòng nhập họ tên người đặt bàn (tối đa 100 ký tự).' });
    }
    if (!customerPhone || typeof customerPhone !== 'string' || !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone.trim())) {
      return res.status(400).json({ message: 'Số điện thoại người đặt không hợp lệ (10 chữ số).' });
    }
    if (!reservationTime) {
      return res.status(400).json({ message: 'Vui lòng chọn thời gian đến dùng bữa.' });
    }

    const bookingDate = new Date(reservationTime);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({ message: 'Thời gian đặt bàn không đúng định dạng.' });
    }

    const numGuests = parseInt(guestCount);
    if (isNaN(numGuests) || numGuests < 1 || numGuests > 200) {
      return res.status(400).json({ message: 'Số lượng khách phải từ 1 đến 200 người.' });
    }

    const numDeposit = depositAmount ? parseFloat(depositAmount) : 0;
    if (isNaN(numDeposit) || numDeposit < 0 || numDeposit > 50000000) {
      return res.status(400).json({ message: 'Số tiền đặt cọc không hợp lệ.' });
    }

    const branch = await prisma.branch.findFirst();
    const finalBranchId = branchId ? parseInt(branchId) || 1 : branch?.id || 1;

    const reservation = await prisma.reservation.create({
      data: {
        branchId: finalBranchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        guestCount: numGuests,
        reservationTime: bookingDate,
        depositAmount: numDeposit,
        note: note && typeof note === 'string' ? note.slice(0, 255) : null,
        status: 'confirmed',
      },
    });

    broadcastEvent(SocketEvents.RESERVATION_CREATED, reservation);

    return res.status(201).json({
      message: 'Đặt bàn thành công! Nhà hàng sẽ liên hệ xác nhận sớm nhất.',
      reservation,
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return res.status(500).json({ message: 'Lỗi khi đặt bàn.' });
  }
});

// GET /api/reservations - Lấy danh sách đặt bàn (POS / Admin)
// SEC FIX: Enforce staff role authorization to protect customer PII and phone numbers
router.get(
  '/',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: Request, res: Response) => {
    try {
      const reservations = await prisma.reservation.findMany({
        orderBy: { reservationTime: 'asc' },
        include: { table: true },
        take: 100,
      });
      return res.json(reservations);
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi tải danh sách đặt bàn.' });
    }
  }
);

// PATCH /api/reservations/:id/check-in - Khách đến: Gán vào bàn và mở phiên phục vụ
// SEC FIX: Enforce staff role authorization and validate inputs
router.patch(
  '/:id/check-in',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: AuthRequest, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id as string);
      if (isNaN(reservationId) || reservationId <= 0) {
        return res.status(400).json({ message: 'Mã đặt bàn không hợp lệ.' });
      }

      const { tableId } = req.body;
      const numTableId = parseInt(tableId);
      if (isNaN(numTableId) || numTableId <= 0) {
        return res.status(400).json({ message: 'Vui lòng chọn bàn hợp lệ để gán cho khách.' });
      }

      const table = await prisma.table.findUnique({ where: { id: numTableId } });
      if (!table || !table.isActive || table.status === 'occupied') {
        return res.status(400).json({ message: 'Bàn đã chọn đang có khách hoặc không khả dụng.' });
      }

      const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) {
        return res.status(404).json({ message: 'Không tìm thấy thông tin đặt bàn.' });
      }

      // 1. Update reservation status
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'seated',
          tableId: table.id,
        },
      });

      // 2. Open table session
      const session = await prisma.tableSession.create({
        data: {
          tableId: table.id,
          sessionToken: crypto.randomUUID(),
          guestCount: reservation.guestCount,
          openedById: req.user?.id,
        },
      });

      // 3. Mark table occupied
      await prisma.table.update({
        where: { id: table.id },
        data: { status: 'occupied' },
      });

      broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
        tableId: table.id,
        status: 'occupied',
        session,
      });

      return res.json({
        message: `Đã check-in thành công cho khách ${reservation.customerName} vào ${table.tableNumber}!`,
        session,
      });
    } catch (error) {
      console.error('Error checking in reservation:', error);
      return res.status(500).json({ message: 'Lỗi khi check-in đặt bàn.' });
    }
  }
);

export default router;
