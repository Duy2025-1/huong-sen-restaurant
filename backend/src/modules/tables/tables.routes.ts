import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// GET /api/tables - Lấy danh sách tất cả các bàn theo khu vực kèm thông tin đơn active
router.get('/', async (req: Request, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { tableNumber: 'asc' },
          include: {
            sessions: {
              where: { isActive: true },
              take: 1,
              include: {
                orders: {
                  where: { status: { notIn: ['completed', 'cancelled'] } },
                  take: 1,
                  include: {
                    orderItems: {
                      include: {
                        dish: true,
                        modifiers: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.json(areas);
  } catch (error) {
    console.error('Error fetching tables:', error);
    return res.status(500).json({ message: 'Lỗi khi tải danh sách bàn.' });
  }
});

// GET /api/tables/by-token/:qrToken - Dành cho khách quét QR tại bàn
router.get('/by-token/:qrToken', async (req: Request, res: Response) => {
  try {
    const qrToken = (req.params.qrToken as string || '').trim();
    if (!qrToken || qrToken.length < 3 || qrToken.length > 100) {
      return res.status(400).json({ message: 'Mã QR không hợp lệ.' });
    }

    const table = await prisma.table.findUnique({
      where: { qrToken },
      include: {
        area: {
          include: { branch: true },
        },
        sessions: {
          where: { isActive: true },
          take: 1,
          include: {
            orders: {
              where: { status: { notIn: ['completed', 'cancelled'] } },
              take: 1,
              include: {
                orderItems: {
                  include: {
                    dish: true,
                    modifiers: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!table || !table.isActive) {
      return res.status(404).json({ message: 'Mã bàn không hợp lệ hoặc đã bị khóa.' });
    }

    const currentSession = table.sessions[0] || null;
    const currentOrder = currentSession?.orders[0] || null;

    return res.json({
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        areaName: table.area.name,
        branch: table.area.branch,
      },
      currentSession,
      currentOrder,
    });
  } catch (error) {
    console.error('Error fetching table by token:', error);
    return res.status(500).json({ message: 'Lỗi server khi quét bàn.' });
  }
});

// POST /api/tables/:id/open-session - Mở bàn đón khách (POS)
// SEC FIX: Enforce staff role authorization to prevent unauthorized session creation
router.post(
  '/:id/open-session',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: AuthRequest, res: Response) => {
    try {
      const tableId = parseInt(req.params.id as string);
      if (isNaN(tableId) || tableId <= 0) {
        return res.status(400).json({ message: 'Mã bàn không hợp lệ.' });
      }

      const { guestCount } = req.body;
      const numGuests = parseInt(guestCount);
      if (isNaN(numGuests) || numGuests < 1 || numGuests > 100) {
        return res.status(400).json({ message: 'Số lượng khách phải từ 1 đến 100 người.' });
      }

      const table = await prisma.table.findUnique({ where: { id: tableId } });
      if (!table || !table.isActive) {
        return res.status(404).json({ message: 'Bàn không tồn tại hoặc đã bị khóa.' });
      }

      // Check if session already active
      const activeSession = await prisma.tableSession.findFirst({
        where: { tableId, isActive: true },
      });

      if (activeSession) {
        return res.status(400).json({ message: 'Bàn này đang có phiên hoạt động.' });
      }

      const sessionToken = crypto.randomUUID();
      const newSession = await prisma.tableSession.create({
        data: {
          tableId,
          sessionToken,
          guestCount: numGuests,
          openedById: req.user?.id,
        },
      });

      // Update table status to occupied
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'occupied' },
      });

      broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
        tableId,
        status: 'occupied',
        session: newSession,
      });

      return res.json({ message: 'Mở bàn thành công.', session: newSession });
    } catch (error) {
      console.error('Error opening session:', error);
      return res.status(500).json({ message: 'Lỗi khi mở bàn.' });
    }
  }
);

// PATCH /api/tables/:id/status - Đổi trạng thái bàn (trống, đang dọn, đã đặt)
// SEC FIX: Enforce staff role authorization and validate allowed enum status values
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: AuthRequest, res: Response) => {
    try {
      const tableId = parseInt(req.params.id as string);
      if (isNaN(tableId) || tableId <= 0) {
        return res.status(400).json({ message: 'Mã bàn không hợp lệ.' });
      }

      const { status } = req.body;
      const validStatuses = ['available', 'reserved', 'occupied', 'cleaning'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái bàn không hợp lệ (available, reserved, occupied, cleaning).' });
      }

      const updated = await prisma.table.update({
        where: { id: tableId },
        data: { status },
      });

      broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, { tableId, status });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái bàn.' });
    }
  }
);

// POST /api/tables/change-table - Chuyển bàn
// SEC FIX: Enforce staff authorization and validate table parameters
router.post(
  '/change-table',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { fromTableId, toTableId } = req.body;
      const numFrom = parseInt(fromTableId);
      const numTo = parseInt(toTableId);

      if (isNaN(numFrom) || isNaN(numTo) || numFrom <= 0 || numTo <= 0) {
        return res.status(400).json({ message: 'Mã bàn gốc và bàn đích không hợp lệ.' });
      }

      if (numFrom === numTo) {
        return res.status(400).json({ message: 'Bàn gốc và bàn đích không thể trùng nhau.' });
      }

      const fromTable = await prisma.table.findUnique({
        where: { id: numFrom },
        include: { sessions: { where: { isActive: true }, take: 1 } },
      });

      const toTable = await prisma.table.findUnique({ where: { id: numTo } });

      if (!fromTable || !toTable) {
        return res.status(404).json({ message: 'Không tìm thấy bàn yêu cầu.' });
      }

      if (toTable.status === 'occupied') {
        return res.status(400).json({ message: 'Bàn đích đang có khách ngồi.' });
      }

      const currentSession = fromTable.sessions[0];
      if (!currentSession) {
        return res.status(400).json({ message: 'Bàn gốc không có phiên hoạt động.' });
      }

      // Move session & orders to target table in ACID transaction
      await prisma.$transaction(async (tx) => {
        await tx.tableSession.update({
          where: { id: currentSession.id },
          data: { tableId: numTo },
        });

        await tx.order.updateMany({
          where: { sessionId: currentSession.id },
          data: { tableId: numTo },
        });

        // Reset fromTable, occupy toTable
        await tx.table.update({ where: { id: numFrom }, data: { status: 'available' } });
        await tx.table.update({ where: { id: numTo }, data: { status: 'occupied' } });
      });

      broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
        fromTableId: numFrom,
        toTableId: numTo,
        action: 'move',
      });

      return res.json({ message: `Đã chuyển từ ${fromTable.tableNumber} sang ${toTable.tableNumber} thành công!` });
    } catch (error) {
      console.error('Error changing table:', error);
      return res.status(500).json({ message: 'Lỗi khi chuyển bàn.' });
    }
  }
);

// GET /api/tables/:id/qr-code - Xuất ảnh DataURL mã QR để in dán bàn
router.get('/:id/qr-code', async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.id as string);
    if (isNaN(tableId) || tableId <= 0) {
      return res.status(400).json({ message: 'Mã bàn không hợp lệ.' });
    }

    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) return res.status(404).json({ message: 'Không tìm thấy bàn.' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const qrUrl = `${clientUrl}/table/${table.qrToken}`;

    const qrImage = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    return res.json({
      tableNumber: table.tableNumber,
      qrUrl,
      qrImage,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tạo mã QR.' });
  }
});

export default router;
