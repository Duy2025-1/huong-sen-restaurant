import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';

export class KdsService {
  /**
   * Lấy danh sách các món đang cần bếp chế biến
   */
  static async getActiveKitchenItems(stationId?: number) {
    const whereClause: any = {
      status: { in: ['pending', 'cooking', 'ready'] },
      order: {
        status: { notIn: ['completed', 'cancelled'] },
      },
    };

    if (stationId && !isNaN(stationId)) {
      whereClause.stationId = stationId;
    }

    return prisma.orderItem.findMany({
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
  }

  /**
   * Cập nhật trạng thái món bếp và đo đếm thời gian chế biến thực tế (Real SLA)
   */
  static async updateItemStatus(itemId: number, nextStatus: string, cancelledReason?: string) {
    const validStatuses = ['pending', 'cooking', 'ready', 'served', 'cancelled'];
    if (!validStatuses.includes(nextStatus)) {
      throw new Error('Trạng thái món bếp không hợp lệ.');
    }

    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: true },
    });

    if (!item) {
      throw new Error('Món bếp không tồn tại.');
    }

    const updateData: any = { status: nextStatus };
    const now = new Date();

    if (nextStatus === 'cooking') {
      updateData.cookingAt = now;
    } else if (nextStatus === 'ready') {
      updateData.readyAt = now;
      if (!item.cookingAt) {
        updateData.cookingAt = item.createdAt;
      }
    } else if (nextStatus === 'served') {
      updateData.servedAt = now;
      if (!item.cookingAt) {
        updateData.cookingAt = item.createdAt;
      }
      if (!item.readyAt) {
        updateData.readyAt = now;
      }
    } else if (nextStatus === 'cancelled') {
      updateData.cancelledAt = now;
      updateData.cancelledReason = cancelledReason || 'Bếp báo hủy';
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

    // Broadcast sự kiện KDS realtime
    broadcastEvent(SocketEvents.KDS_ITEM_UPDATED, {
      itemId: updatedItem.id,
      orderId: updatedItem.orderId,
      status: updatedItem.status,
      tableNumber: updatedItem.order.table?.tableNumber,
      dishName: updatedItem.dish.name,
      updatedItem,
    });

    return updatedItem;
  }
}
