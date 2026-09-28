import { Router, Request, Response } from 'express';
import { KdsService } from './kds.service.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu quyền nhân viên Bếp / Quản lý / Admin
router.use(authenticate, authorize(['admin', 'manager', 'chef']));

// GET /api/kds/items - Lấy các món đang chế biến
router.get('/items', async (req: Request, res: Response) => {
  try {
    const stationId = req.query.stationId ? parseInt(req.query.stationId as string) : undefined;
    const items = await KdsService.getActiveKitchenItems(stationId);
    return res.json(items);
  } catch (error) {
    console.error('Error fetching KDS items:', error);
    return res.status(500).json({ message: 'Lỗi tải danh sách món cho bếp.' });
  }
});

// PATCH /api/kds/items/:id/status - Chuyển trạng thái món (Chờ -> Nấu -> Xong -> Đã phục vụ)
router.patch('/items/:id/status', async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id as string);
    if (isNaN(itemId) || itemId <= 0) {
      return res.status(400).json({ message: 'Mã món bếp không hợp lệ.' });
    }

    const { status, cancelledReason } = req.body;
    const updated = await KdsService.updateItemStatus(itemId, status, cancelledReason);
    return res.json(updated);
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Lỗi cập nhật trạng thái món bếp.' });
  }
});

export default router;
