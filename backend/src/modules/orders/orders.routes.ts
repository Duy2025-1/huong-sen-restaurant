import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();

// Rate limiter for public order lookup to prevent brute-force phone/order scraping
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
    const { tableId, qrToken, items, note, customerName, customerPhone } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Danh sách món trong giỏ hàng không được để trống.' });
    }

    if (items.length > 50) {
      return res.status(400).json({ message: 'Mỗi lần gọi món không vượt quá 50 loại món.' });
    }

    // Find table either by tableId or qrToken
    const parsedTableId = tableId ? parseInt(tableId) : undefined;
    const table = await prisma.table.findFirst({
      where: parsedTableId ? { id: parsedTableId } : { qrToken: typeof qrToken === 'string' ? qrToken : '' },
      include: {
        area: { include: { branch: true } },
        sessions: { where: { isActive: true }, take: 1 },
      },
    });

    if (!table || !table.isActive) {
      return res.status(404).json({ message: 'Không tìm thấy bàn yêu cầu hoặc bàn đã bị tạm ngưng.' });
    }

    // 1. Get or create active Table Session
    let session = table.sessions[0];
    if (!session) {
      session = await prisma.tableSession.create({
        data: {
          tableId: table.id,
          sessionToken: crypto.randomUUID(),
          guestCount: 2,
        },
      });

      await prisma.table.update({
        where: { id: table.id },
        data: { status: 'occupied' },
      });

      broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
        tableId: table.id,
        status: 'occupied',
      });
    }

    // 2. Find active order for this session or create a new one
    let activeOrder = await prisma.order.findFirst({
      where: {
        sessionId: session.id,
        status: { notIn: ['completed', 'cancelled'] },
      },
      include: { orderItems: true },
    });

    let currentRound = 1;

    if (!activeOrder) {
      const orderCode = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      activeOrder = await prisma.order.create({
        data: {
          code: orderCode,
          branchId: table.area.branchId,
          sessionId: session.id,
          tableId: table.id,
          orderType: 'dine_in',
          status: 'preparing',
          note: note && typeof note === 'string' ? note.slice(0, 255) : null,
          customerName: customerName && typeof customerName === 'string' ? customerName.slice(0, 100) : null,
          customerPhone: customerPhone && typeof customerPhone === 'string' ? customerPhone.slice(0, 20) : null,
        },
        include: { orderItems: true },
      });
    } else {
      const maxRound = activeOrder.orderItems.reduce((max, item) => Math.max(max, item.roundNumber), 1);
      currentRound = maxRound + 1;
    }

    // 3. Process each order item & modifiers with strict validation
    let addedItemsSubtotal = 0;
    const createdItems = [];

    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0 || qty > 100) {
        continue;
      }

      const dishId = parseInt(item.dishId);
      if (isNaN(dishId)) continue;

      const dish = await prisma.dish.findUnique({ where: { id: dishId } });
      if (!dish || !dish.isAvailable) continue;

      // Price is ALWAYS securely taken from the database
      const unitPrice = dish.discountedPrice || dish.price;
      let modifiersPrice = 0;
      const modifiersData: Array<{ modifierItemId: number; nameAtTime: string; priceAtTime: number }> = [];

      if (item.modifierItemIds && Array.isArray(item.modifierItemIds) && item.modifierItemIds.length > 0) {
        const validModIds = item.modifierItemIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        const modifiers = await prisma.modifierItem.findMany({
          where: { id: { in: validModIds } },
        });

        for (const mod of modifiers) {
          modifiersPrice += mod.additionalPrice;
          modifiersData.push({
            modifierItemId: mod.id,
            nameAtTime: mod.name,
            priceAtTime: mod.additionalPrice,
          });
        }
      }

      const totalPrice = (unitPrice + modifiersPrice) * qty;
      addedItemsSubtotal += totalPrice;

      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: activeOrder.id,
          dishId: dish.id,
          stationId: dish.stationId,
          quantity: qty,
          unitPrice,
          modifiersPrice,
          totalPrice,
          kitchenNote: item.kitchenNote && typeof item.kitchenNote === 'string' ? item.kitchenNote.slice(0, 200) : '',
          roundNumber: currentRound,
          status: 'pending',
          modifiers: {
            create: modifiersData,
          },
        },
        include: {
          dish: true,
          modifiers: true,
          station: true,
        },
      });

      createdItems.push(orderItem);
    }

    if (createdItems.length === 0) {
      return res.status(400).json({ message: 'Không có món ăn hợp lệ hoặc các món đã hết hàng.' });
    }

    // 4. Update order total amount
    const updatedOrder = await prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        subtotalAmount: { increment: addedItemsSubtotal },
        totalAmount: { increment: addedItemsSubtotal },
        status: 'preparing',
      },
      include: {
        table: true,
        orderItems: {
          include: { dish: true, modifiers: true, station: true },
        },
      },
    });

    // 5. Emit Real-time Socket events
    broadcastEvent(SocketEvents.ORDER_ITEMS_ADDED, {
      orderId: updatedOrder.id,
      orderCode: updatedOrder.code,
      tableNumber: table.tableNumber,
      roundNumber: currentRound,
      items: createdItems,
    });

    broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
      tableId: table.id,
      status: 'occupied',
      order: updatedOrder,
    });

    return res.status(201).json({
      message: 'Gọi món thành công!',
      order: updatedOrder,
      roundNumber: currentRound,
      newItems: createdItems,
    });
  } catch (error) {
    console.error('Error creating dine-in order:', error);
    return res.status(500).json({ message: 'Lỗi server khi gọi món.' });
  }
});

// 2. POST /api/orders/delivery - Đặt món giao hàng / mang về trực tiếp từ Web Cart
router.post('/delivery', async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, deliveryAddress, orderType, paymentMethod, items, note } = req.body;

    // Strict Input Validation
    if (!customerName || typeof customerName !== 'string' || !customerName.trim() || customerName.trim().length > 100) {
      return res.status(400).json({ message: 'Vui lòng nhập tên người nhận hợp lệ (tối đa 100 ký tự).' });
    }
    if (!customerPhone || typeof customerPhone !== 'string' || !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(customerPhone.trim())) {
      return res.status(400).json({ message: 'Số điện thoại người nhận không hợp lệ (10 chữ số).' });
    }
    if (orderType === 'delivery' && (!deliveryAddress || typeof deliveryAddress !== 'string' || !deliveryAddress.trim())) {
      return res.status(400).json({ message: 'Vui lòng nhập địa chỉ giao hàng hợp lệ.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ message: 'Giỏ hàng không hợp lệ (cần từ 1 đến 50 món).' });
    }

    const branch = await prisma.branch.findFirst();
    const branchId = branch?.id || 1;

    let subtotalAmount = 0;
    const validatedItemsData = [];

    for (const item of items) {
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0 || qty > 100) {
        return res.status(400).json({ message: 'Số lượng mỗi món phải từ 1 đến 100.' });
      }

      const dishId = parseInt(item.dishId);
      if (isNaN(dishId)) {
        return res.status(400).json({ message: 'Mã món ăn không hợp lệ.' });
      }

      const dish = await prisma.dish.findUnique({ where: { id: dishId } });
      if (!dish) {
        return res.status(404).json({ message: 'Món ăn không tồn tại.' });
      }
      if (!dish.isAvailable) {
        return res.status(400).json({ message: `Món "${dish.name}" hiện đã hết hàng.` });
      }

      // Security: Unit price is ALWAYS retrieved from database
      const unitPrice = dish.discountedPrice || dish.price;
      let modifiersPrice = 0;
      const modifiersData: Array<{ modifierItemId: number; nameAtTime: string; priceAtTime: number }> = [];

      if (item.modifierItemIds && Array.isArray(item.modifierItemIds) && item.modifierItemIds.length > 0) {
        const validModIds = item.modifierItemIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        const modifiers = await prisma.modifierItem.findMany({
          where: { id: { in: validModIds } },
        });

        for (const mod of modifiers) {
          modifiersPrice += mod.additionalPrice;
          modifiersData.push({
            modifierItemId: mod.id,
            nameAtTime: mod.name,
            priceAtTime: mod.additionalPrice,
          });
        }
      }

      const totalPrice = (unitPrice + modifiersPrice) * qty;
      subtotalAmount += totalPrice;

      validatedItemsData.push({
        dishId: dish.id,
        stationId: dish.stationId,
        quantity: qty,
        unitPrice,
        modifiersPrice,
        totalPrice,
        kitchenNote: item.kitchenNote && typeof item.kitchenNote === 'string' ? item.kitchenNote.slice(0, 200) : '',
        modifiers: modifiersData,
      });
    }

    const orderCode = `ORD-${orderType === 'delivery' ? 'DLV' : 'TAK'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder = await prisma.order.create({
      data: {
        code: orderCode,
        branchId,
        orderType: orderType === 'takeaway' ? 'takeaway' : 'delivery',
        status: 'pending',
        paymentStatus: paymentMethod === 'vnpay' ? 'paid' : 'unpaid',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress && typeof deliveryAddress === 'string' ? deliveryAddress.trim().slice(0, 255) : null,
        subtotalAmount,
        totalAmount: subtotalAmount,
        note: note && typeof note === 'string' ? note.slice(0, 255) : null,
        orderItems: {
          create: validatedItemsData.map((v) => ({
            dishId: v.dishId,
            stationId: v.stationId,
            quantity: v.quantity,
            unitPrice: v.unitPrice,
            modifiersPrice: v.modifiersPrice,
            totalPrice: v.totalPrice,
            kitchenNote: v.kitchenNote,
            modifiers: {
              create: v.modifiers,
            },
          })),
        },
      },
      include: {
        orderItems: {
          include: { dish: true, modifiers: true },
        },
      },
    });

    broadcastEvent(SocketEvents.ORDER_CREATED, newOrder);

    return res.status(201).json({
      message: 'Đặt đơn hàng thành công!',
      order: newOrder,
    });
  } catch (error) {
    console.error('Error creating delivery order:', error);
    return res.status(500).json({ message: 'Lỗi server khi đặt đơn hàng.' });
  }
});

// 3. GET /api/orders - Quản lý tất cả đơn hàng (Admin & Staff)
// SEC FIX: Enforce staff role authorization to prevent customers from viewing all restaurant orders
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
// SEC FIX: Enforce staff role authorization
router.get(
  '/active',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter', 'chef']),
  async (req: Request, res: Response) => {
    try {
      const orders = await prisma.order.findMany({
        where: {
          status: { notIn: ['completed', 'cancelled'] },
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

// 5. PATCH /api/orders/:id/status - Cập nhật trạng thái đơn hàng (Admin / Thu ngân / Phục vụ)
// SEC FIX: Enforce staff role authorization so public customers cannot tamper with orders
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin', 'manager', 'cashier', 'waiter']),
  async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id as string);
      if (isNaN(orderId) || orderId <= 0) {
        return res.status(400).json({ message: 'Mã đơn hàng không hợp lệ.' });
      }

      const { status } = req.body;
      const validStatuses = ['pending', 'preparing', 'cooking', 'ready', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái đơn hàng không hợp lệ.' });
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: {
          table: true,
          orderItems: { include: { dish: true } },
        },
      });

      broadcastEvent('order_status_updated', updated);

      return res.json({ message: 'Cập nhật trạng thái đơn thành công!', order: updated });
    } catch (error) {
      return res.status(500).json({ message: 'Lỗi cập nhật trạng thái đơn hàng.' });
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

    const orders = await prisma.order.findMany({
      where: {
        OR: [{ code: rawQuery }, { customerPhone: rawQuery }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        table: true,
        orderItems: {
          include: { dish: true, modifiers: true },
        },
      },
      take: 10,
    });

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
      return res.status(400).json({ message: 'Đơn hàng này đã kết thúc hoặc đã hủy.' });
    }

    broadcastEvent(SocketEvents.BILL_REQUESTED, {
      orderId: order.id,
      orderCode: order.code,
      tableNumber: order.table?.tableNumber || 'Bàn không xác định',
      totalAmount: order.totalAmount,
    });

    return res.json({ message: 'Đã gửi yêu cầu thanh toán đến thu ngân!' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi gửi yêu cầu thanh toán.' });
  }
});

export default router;
