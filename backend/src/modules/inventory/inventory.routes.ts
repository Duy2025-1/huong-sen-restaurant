import { Router, Request, Response } from 'express';
import { InventoryService } from './inventory.service.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// Yêu cầu quyền nhân viên
router.use(authenticate, authorize(['admin', 'manager', 'chef']));

// GET /api/inventory - Lấy danh sách nguyên vật liệu kho
router.get('/', async (req: Request, res: Response) => {
  try {
    const ingredients = await InventoryService.getIngredients();
    return res.json({ success: true, data: ingredients });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message || 'Lỗi tải kho.' } });
  }
});

// GET /api/inventory/alerts - Cảnh báo nguyên liệu sắp hết
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await InventoryService.getLowStockAlerts();
    return res.json({ success: true, data: alerts });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message || 'Lỗi kiểm tra cảnh báo kho.' } });
  }
});

// POST /api/inventory/transaction - Ghi nhận biến động kho (Nhập/Xuất/Hao hụt/Cân đối)
router.post('/transaction', async (req: AuthRequest, res: Response) => {
  try {
    const { ingredientId, type, quantity, unitCost, note } = req.body;
    const numId = parseInt(ingredientId);
    const numQty = parseFloat(quantity);

    if (isNaN(numId) || numId <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Mã nguyên liệu không hợp lệ.' } });
    }
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({ success: false, error: { message: 'Số lượng phải là số không âm.' } });
    }
    if (!['IN', 'OUT', 'ADJUSTMENT', 'WASTE'].includes(type)) {
      return res.status(400).json({ success: false, error: { message: 'Loại biến động không hợp lệ (IN, OUT, ADJUSTMENT, WASTE).' } });
    }

    const result = await InventoryService.recordTransaction({
      ingredientId: numId,
      type,
      quantity: numQty,
      unitCost: unitCost ? parseFloat(unitCost) : undefined,
      note: typeof note === 'string' ? note.slice(0, 255) : undefined,
      staffId: req.user?.id,
    });

    return res.status(201).json({ success: true, message: 'Cập nhật kho thành công!', data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: { message: error.message || 'Lỗi cập nhật kho.' } });
  }
});

// GET /api/inventory/recipes - Danh sách công thức món
router.get('/recipes', async (req: Request, res: Response) => {
  try {
    const recipes = await InventoryService.getRecipes();
    return res.json({ success: true, data: recipes });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message || 'Lỗi tải công thức.' } });
  }
});

export default router;
