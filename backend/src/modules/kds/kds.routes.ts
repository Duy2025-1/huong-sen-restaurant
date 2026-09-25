import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// GET /api/kds/items - Lấy các món đang chế biến phục vụ màn hình Bếp/Bar
// SEC FIX: Add authenticate and authorize(['admin', 'manager', 'chef']) so unauthorized internet users cannot view kitchen orders
router.get(
  '/items',
  authenticate,
  authorize(['admin', 'manager', 'chef']),
  async (req: Request, res: Response) => {
    try {
      const { stationId } = req.query;

      const whereClause: any = {
        status: { in: ['pending', 'cooking', 'ready'] },
        order: {
          status: { notIn: ['completed', 'cancelled'] },
        },
      };

      if (stationId && stationId !== 'all') {
        const parsedStationId = parseInt(stationId as string);
        if (!isNaN(parsedStationId) && parsedStationId > 0) {
          whereClause.stationId = parsedStationId;
        }
      }

      const items = await prisma.orderItem.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        include: {
          dish: true,
          modifiers: true,
          station: true,
          order: {
            include: {
              table: true,
            },
          },
        },
      });

      return res.json(items);
    } catch (error) {
      console.error('Error fetching KDS items:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách món cho bếp.' });
    }
  }
);

// PATCH /api/kds/items/:id/status - Chuyển trạng thái món (Chờ -> Nấu -> Xong -> Đã phục vụ)
// SEC FIX: Enforce staff authentication & authorization to prevent arbitrary order item cancellation or status spoofing
router.patch(
  '/items/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'chef']),
  async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.id as string);
      if (isNaN(itemId) || itemId <= 0) {
        return res.status(400).json({ message: 'Mã món bếp không hợp lệ.' });
      }

      const { status, cancelledReason } = req.body;
      const validStatuses = ['pending', 'cooking', 'ready', 'served', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái món bếp không hợp lệ.' });
      }

      const updateData: any = { status };
      const now = new Date();

      if (status === 'cooking') updateData.cookingAt = now;
      if (status === 'ready') updateData.readyAt = now;
      if (status === 'served') updateData.servedAt = now;
      if (status === 'cancelled') {
        updateData.cancelledAt = now;
        updateData.cancelledReason =
          cancelledReason && typeof cancelledReason === 'string'
            ? cancelledReason.slice(0, 200)
            : 'Bếp báo hủy';
      }

      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          dish: true,
          modifiers: true,
          station: true,
          order: {
            include: { table: true },
          },
        },
      });

      // Broadcast realtime event to Kitchen, POS and Customer
      broadcastEvent(SocketEvents.KDS_ITEM_UPDATED, {
        itemId: updatedItem.id,
        orderId: updatedItem.orderId,
        status: updatedItem.status,
        tableNumber: updatedItem.order.table?.tableNumber,
        dishName: updatedItem.dish.name,
        updatedItem,
      });

      return res.json(updatedItem);
    } catch (error) {
      console.error('Error updating KDS item:', error);
      return res.status(500).json({ message: 'Lỗi cập nhật trạng thái món bếp.' });
    }
  }
);

export default router;
