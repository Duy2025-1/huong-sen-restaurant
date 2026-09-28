import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface OrderItemInput {
  dishId: number;
  quantity: number;
  modifierItemIds?: number[];
  kitchenNote?: string;
}

export interface DineInOrderInput {
  tableId?: number;
  qrToken?: string;
  items: OrderItemInput[];
  note?: string;
  customerName?: string;
  customerPhone?: string;
  createdById?: number;
  idempotencyKey?: string;
}

export interface DeliveryOrderInput {
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  orderType: 'delivery' | 'takeout';
  paymentMethod: string;
  items: OrderItemInput[];
  note?: string;
  promoCode?: string;
  idempotencyKey?: string;
}

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'out_for_delivery', 'completed', 'cancelled'],
  served: ['completed'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [], // Không thể quay lại trạng thái trước
  cancelled: ['refunded'],
  refunded: [],
};

export class OrdersService {
  /**
   * Sinh mã đơn hàng chuẩn HƯƠNG SEN: HS-YYYYMMDD-XXXX
   */
  static generateOrderCode(prefix: string = 'HS') {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${today}-${rand}`;
  }

  /**
   * 1. TẠO ĐƠN GỌI MÓN TẠI BÀN (DINE-IN)
   */
  static async createDineInOrder(input: DineInOrderInput) {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          table: true,
          orderItems: { include: { dish: true, modifiers: true } },
        },
      });
      if (existing) {
        return { isDuplicate: true, order: existing, roundNumber: 1, newItems: [] };
      }
    }

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('Danh sách món không được để trống.');
    }

    // 2. Tìm bàn ăn theo tableId hoặc qrToken
    const table = await prisma.table.findFirst({
      where: input.tableId ? { id: input.tableId } : { qrToken: input.qrToken || '' },
      include: {
        area: { include: { branch: true } },
        sessions: { where: { isActive: true }, take: 1 },
      },
    });

    if (!table || !table.isActive) {
      throw new Error('Bàn ăn không tồn tại hoặc đã bị khóa.');
    }

    // 3. Thực thi ACID Transaction toàn diện
    const result = await prisma.$transaction(async (tx) => {
      // 3.1 Phiên bàn ăn (TableSession)
      let session = table.sessions[0];
      if (!session) {
        session = await tx.tableSession.create({
          data: {
            tableId: table.id,
            sessionToken: crypto.randomUUID(),
            guestCount: 2,
            openedById: input.createdById || null,
          },
        });

        await tx.table.update({
          where: { id: table.id },
          data: { status: 'occupied' },
        });

        broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
          tableId: table.id,
          status: 'occupied',
        });
      }

      // 3.2 Tìm đơn active của phiên bàn hoặc tạo đơn mới
      let activeOrder = await tx.order.findFirst({
        where: {
          sessionId: session.id,
          status: { notIn: ['completed', 'cancelled'] },
        },
        include: { orderItems: true },
      });

      let currentRound = 1;
      if (!activeOrder) {
        const orderCode = this.generateOrderCode('HS-TB');
        activeOrder = await tx.order.create({
          data: {
            code: orderCode,
            idempotencyKey: input.idempotencyKey || null,
            branchId: table.area.branchId,
            sessionId: session.id,
            tableId: table.id,
            orderType: 'dine_in',
            status: 'preparing',
            paymentStatus: 'unpaid',
            note: input.note ? input.note.slice(0, 255) : null,
            customerName: input.customerName ? input.customerName.slice(0, 100) : `Khách tại ${table.tableNumber}`,
            customerPhone: input.customerPhone ? input.customerPhone.slice(0, 20) : null,
            createdById: input.createdById || null,
          },
          include: { orderItems: true },
        });

        // Ghi lịch sử trạng thái khởi tạo
        await tx.orderStatusHistory.create({
          data: {
            orderId: activeOrder.id,
            fromStatus: null,
            toStatus: 'preparing',
            changedById: input.createdById || null,
            reason: 'Khởi tạo đơn gọi món tại bàn',
          },
        });
      } else {
        const maxRound = activeOrder.orderItems.reduce((max, item) => Math.max(max, item.roundNumber), 1);
        currentRound = maxRound + 1;
      }

      // 3.3 Validate món ăn & lấy giá trực tiếp từ database
      let addedItemsSubtotal = 0;
      const createdOrderItems = [];

      for (const item of input.items) {
        const qty = parseInt(item.quantity as any);
        if (isNaN(qty) || qty <= 0 || qty > 100) continue;

        const dishId = parseInt(item.dishId as any);
        if (isNaN(dishId)) continue;

        const dish = await tx.dish.findUnique({ where: { id: dishId } });
        if (!dish) throw new Error(`Món ăn ID ${dishId} không tồn tại.`);
        if (!dish.isAvailable) throw new Error(`Món "${dish.name}" hiện đã hết phục vụ.`);

        // GIÁ ĐƯỢC LẤY 100% TỪ DATABASE
        const unitPrice = dish.discountedPrice || dish.price;
        let modifiersPrice = 0;
        const modifiersData: Array<{ modifierItemId: number; nameAtTime: string; priceAtTime: number }> = [];

        if (item.modifierItemIds && Array.isArray(item.modifierItemIds) && item.modifierItemIds.length > 0) {
          const modItems = await tx.modifierItem.findMany({
            where: { id: { in: item.modifierItemIds.map(Number) } },
          });

          for (const m of modItems) {
            modifiersPrice += m.additionalPrice;
            modifiersData.push({
              modifierItemId: m.id,
              nameAtTime: m.name,
              priceAtTime: m.additionalPrice,
            });
          }
        }

        const totalPrice = (unitPrice + modifiersPrice) * qty;
        addedItemsSubtotal += totalPrice;

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: activeOrder.id,
            dishId: dish.id,
            stationId: dish.stationId,
            dishNameSnapshot: dish.name,
            quantity: qty,
            unitPrice,
            modifiersPrice,
            totalPrice,
            kitchenNote: item.kitchenNote ? item.kitchenNote.slice(0, 200) : '',
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

        createdOrderItems.push(orderItem);

        // Cập nhật số lượng bán
        await tx.dish.update({
          where: { id: dish.id },
          data: { soldCount: { increment: qty } },
        });
      }

      if (createdOrderItems.length === 0) {
        throw new Error('Không có món ăn hợp lệ để thêm vào đơn.');
      }

      // 3.4 Tạo KitchenTicket cho đợt gọi món này
      const ticketCode = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
      await tx.kitchenTicket.create({
        data: {
          orderId: activeOrder.id,
          ticketCode,
          roundNumber: currentRound,
          status: 'pending',
        },
      });

      // 3.5 Cập nhật tổng tiền đơn hàng
      const updatedOrder = await tx.order.update({
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

      return {
        order: updatedOrder,
        roundNumber: currentRound,
        newItems: createdOrderItems,
        tableNumber: table.tableNumber,
      };
    });

    // 4. Trừ nguyên liệu kho (chạy asynchronous, không block đơn)
    for (const item of result.newItems) {
      InventoryService.deductForOrderDish(item.dishId, item.quantity, result.order.id, input.createdById);
    }

    // 5. Phát sự kiện WebSocket Realtime
    broadcastEvent(SocketEvents.ORDER_ITEMS_ADDED, {
      orderId: result.order.id,
      orderCode: result.order.code,
      tableNumber: result.tableNumber,
      roundNumber: result.roundNumber,
      items: result.newItems,
    });

    broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
      tableId: result.order.tableId,
      status: 'occupied',
      order: result.order,
    });

    return { isDuplicate: false, ...result };
  }

  /**
   * 2. TẠO ĐƠN ĐẶT GIAO HÀNG / MANG VỀ (DELIVERY / TAKEOUT)
   */
  static async createDeliveryOrder(input: DeliveryOrderInput) {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          orderItems: { include: { dish: true, modifiers: true } },
        },
      });
      if (existing) {
        return { isDuplicate: true, order: existing };
      }
    }

    // Validation cơ bản
    if (!input.customerName || !input.customerName.trim()) {
      throw new Error('Vui lòng nhập họ tên người nhận.');
    }
    if (!input.customerPhone || !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(input.customerPhone.trim())) {
      throw new Error('Số điện thoại nhận hàng không hợp lệ (10 chữ số).');
    }
    if (input.orderType === 'delivery' && (!input.deliveryAddress || !input.deliveryAddress.trim())) {
      throw new Error('Vui lòng nhập địa chỉ nhận hàng giao tận nơi.');
    }
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('Giỏ hàng trống.');
    }

    const branch = await prisma.branch.findFirst();
    const branchId = branch?.id || 1;

    // 2. ACID Transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      let subtotalAmount = 0;
      const validatedItems = [];

      for (const item of input.items) {
        const qty = parseInt(item.quantity as any);
        if (isNaN(qty) || qty <= 0 || qty > 100) {
          throw new Error('Số lượng món không hợp lệ (1-100).');
        }

        const dishId = parseInt(item.dishId as any);
        const dish = await tx.dish.findUnique({ where: { id: dishId } });
        if (!dish) throw new Error(`Món ăn ID ${dishId} không tồn tại.`);
        if (!dish.isAvailable) throw new Error(`Món "${dish.name}" hiện đã hết hàng.`);

        // Giá từ database
        const unitPrice = dish.discountedPrice || dish.price;
        let modifiersPrice = 0;
        const modifiersData: Array<{ modifierItemId: number; nameAtTime: string; priceAtTime: number }> = [];

        if (item.modifierItemIds && Array.isArray(item.modifierItemIds) && item.modifierItemIds.length > 0) {
          const modItems = await tx.modifierItem.findMany({
            where: { id: { in: item.modifierItemIds.map(Number) } },
          });

          for (const m of modItems) {
            modifiersPrice += m.additionalPrice;
            modifiersData.push({
              modifierItemId: m.id,
              nameAtTime: m.name,
              priceAtTime: m.additionalPrice,
            });
          }
        }

        const totalPrice = (unitPrice + modifiersPrice) * qty;
        subtotalAmount += totalPrice;

        validatedItems.push({
          dishId: dish.id,
          stationId: dish.stationId,
          dishNameSnapshot: dish.name,
          quantity: qty,
          unitPrice,
          modifiersPrice,
          totalPrice,
          kitchenNote: item.kitchenNote ? item.kitchenNote.slice(0, 200) : '',
          modifiers: modifiersData,
        });

        await tx.dish.update({
          where: { id: dish.id },
          data: { soldCount: { increment: qty } },
        });
      }

      // Xử lý mã khuyến mãi nếu có
      let discountAmount = 0;
      if (input.promoCode) {
        const promo = await tx.promotion.findUnique({
          where: { code: input.promoCode.toUpperCase() },
        });
        const now = new Date();
        if (promo && promo.isActive && now >= promo.startDate && now <= promo.endDate) {
          if (subtotalAmount >= promo.minOrderAmount) {
            if (promo.discountType === 'PERCENT') {
              discountAmount = (subtotalAmount * promo.discountValue) / 100;
              if (promo.maxDiscountAmount) {
                discountAmount = Math.min(discountAmount, promo.maxDiscountAmount);
              }
            } else {
              discountAmount = promo.discountValue;
            }
          }
        }
      }

      // Phí giao hàng: Miễn phí nếu trên 200.000đ hoặc mang về
      const deliveryFee = input.orderType === 'takeout' || subtotalAmount >= 200000 ? 0 : 25000;
      const totalAmount = Math.max(0, subtotalAmount - discountAmount + deliveryFee);

      const prefix = input.orderType === 'delivery' ? 'HS-DLV' : 'HS-TAK';
      const orderCode = this.generateOrderCode(prefix);

      const order = await tx.order.create({
        data: {
          code: orderCode,
          idempotencyKey: input.idempotencyKey || null,
          branchId,
          orderType: input.orderType === 'takeout' ? 'takeout' : 'delivery',
          status: 'pending',
          paymentStatus: 'unpaid', // Luôn khởi tạo unpaid; thanh toán thực hiện ở bước xác nhận
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          deliveryAddress: input.deliveryAddress ? input.deliveryAddress.trim().slice(0, 255) : null,
          subtotalAmount,
          discountAmount,
          deliveryFee,
          totalAmount,
          note: input.note ? input.note.slice(0, 255) : null,
          orderItems: {
            create: validatedItems.map((v) => ({
              dishId: v.dishId,
              stationId: v.stationId,
              dishNameSnapshot: v.dishNameSnapshot,
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

      // Lịch sử trạng thái
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'pending',
          reason: 'Khách đặt trực tuyến qua website',
        },
      });

      return order;
    });

    // Trừ nguyên liệu
    for (const item of newOrder.orderItems) {
      InventoryService.deductForOrderDish(item.dishId, item.quantity, newOrder.id);
    }

    // Realtime notification
    broadcastEvent(SocketEvents.ORDER_CREATED, newOrder);

    return { isDuplicate: false, order: newOrder };
  }

  /**
   * 3. CHUYỂN TRẠNG THÁI ĐƠN HÀNG CÓ KIỂM SOÁT TRANSITION (STATE MACHINE)
   */
  static async updateOrderStatus(orderId: number, nextStatus: string, changedById?: number | null, reason?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true, session: true },
    });

    if (!order) {
      throw new Error('Đơn hàng không tồn tại.');
    }

    const currentStatus = order.status;

    // Kiểm tra state transition hợp lệ
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(nextStatus)) {
      throw new Error(
        `Không thể chuyển trạng thái từ "${currentStatus.toUpperCase()}" sang "${nextStatus.toUpperCase()}". Quy trình nghiệp vụ không cho phép đảo ngược trạng thái.`
      );
    }

    // Cập nhật trạng thái và ghi Audit & Status History trong transaction
    const updated = await prisma.$transaction(async (tx) => {
      const uOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
        include: {
          table: true,
          orderItems: { include: { dish: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: currentStatus,
          toStatus: nextStatus,
          changedById: changedById || null,
          reason: reason || null,
        },
      });

      await AuditService.log({
        staffId: changedById,
        action: 'UPDATE_ORDER_STATUS',
        entity: 'Order',
        entityId: orderId,
        oldValue: { status: currentStatus },
        newValue: { status: nextStatus, reason },
      });

      return uOrder;
    });

    broadcastEvent('order_status_updated', updated);
    return updated;
  }

  /**
   * 4. TRA CỨU ĐƠN HÀNG THEO SĐT HOẶC MÃ ĐƠN
   */
  static async lookupOrder(query: string) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    return prisma.order.findMany({
      where: {
        OR: [
          { code: { equals: cleanQuery } },
          { customerPhone: { equals: cleanQuery } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        table: { include: { area: true } },
        orderItems: {
          include: {
            dish: true,
            modifiers: true,
          },
        },
        statusHistories: {
          orderBy: { createdAt: 'asc' },
        },
        payments: true,
      },
    });
  }
}
