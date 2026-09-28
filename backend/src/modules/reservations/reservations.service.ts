import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { AuditService } from '../audit/audit.service.js';

export interface CreateReservationInput {
  branchId?: number;
  tableId?: number | null;
  customerId?: number | null;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservationTime: string | Date;
  depositAmount?: number;
  note?: string;
}

export class ReservationsService {
  /**
   * Đặt bàn mới với kiểm tra xung đột thời gian (Time-slot Conflict Checking)
   */
  static async createReservation(input: CreateReservationInput) {
    if (!input.customerName || !input.customerName.trim()) {
      throw new Error('Vui lòng nhập họ tên người đặt bàn.');
    }
    if (!input.customerPhone || !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(input.customerPhone.trim())) {
      throw new Error('Số điện thoại người đặt không hợp lệ.');
    }

    const bookingDate = new Date(input.reservationTime);
    if (isNaN(bookingDate.getTime())) {
      throw new Error('Thời gian đặt bàn không đúng định dạng.');
    }

    const numGuests = parseInt(input.guestCount as any);
    if (isNaN(numGuests) || numGuests < 1 || numGuests > 200) {
      throw new Error('Số lượng khách phải từ 1 đến 200 người.');
    }

    const branch = await prisma.branch.findFirst();
    const branchId = input.branchId || branch?.id || 1;

    // Khoảng thời gian ăn ước tính: 2 tiếng
    const slotDurationMs = 2 * 60 * 60 * 1000;
    const bookingEnd = new Date(bookingDate.getTime() + slotDurationMs);

    // Nếu có chỉ định bàn cụ thể -> Kiểm tra xung đột lịch đặt cùng bàn
    if (input.tableId) {
      const conflicting = await prisma.reservation.findFirst({
        where: {
          tableId: input.tableId,
          status: { in: ['pending', 'confirmed', 'seated'] },
          reservationTime: {
            gte: new Date(bookingDate.getTime() - slotDurationMs),
            lte: bookingEnd,
          },
        },
      });

      if (conflicting) {
        throw new Error('Bàn ăn đã có khách đặt trước trong khung giờ này. Vui lòng chọn bàn hoặc giờ khác.');
      }
    }

    const code = `RES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const reservation = await prisma.reservation.create({
      data: {
        code,
        branchId,
        customerId: input.customerId || null,
        tableId: input.tableId || null,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        guestCount: numGuests,
        reservationTime: bookingDate,
        endTime: bookingEnd,
        depositAmount: input.depositAmount ? Math.max(0, parseFloat(input.depositAmount as any)) : 0,
        note: input.note ? input.note.slice(0, 255) : null,
        status: 'confirmed',
      },
      include: {
        table: true,
      },
    });

    // Nếu có bàn -> Cập nhật trạng thái bàn sang "reserved" nếu thời gian đặt trong vòng 2 tiếng tới
    if (reservation.tableId) {
      const timeDiff = bookingDate.getTime() - Date.now();
      if (timeDiff > 0 && timeDiff <= 2 * 60 * 60 * 1000) {
        await prisma.table.update({
          where: { id: reservation.tableId },
          data: { status: 'reserved' },
        });

        broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
          tableId: reservation.tableId,
          status: 'reserved',
        });
      }
    }

    broadcastEvent(SocketEvents.RESERVATION_CREATED, reservation);
    return reservation;
  }

  /**
   * Cập nhật trạng thái đặt bàn
   */
  static async updateStatus(id: number, nextStatus: string, staffId?: number | null) {
    const validStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(nextStatus)) {
      throw new Error('Trạng thái đặt bàn không hợp lệ.');
    }

    const res = await prisma.reservation.findUnique({ where: { id } });
    if (!res) throw new Error('Thông tin đặt bàn không tồn tại.');

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: nextStatus },
      include: { table: true },
    });

    // Nếu khách ngồi vào bàn (seated) -> Đổi trạng thái bàn thành occupied
    if (nextStatus === 'seated' && updated.tableId) {
      await prisma.table.update({
        where: { id: updated.tableId },
        data: { status: 'occupied' },
      });
      broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
        tableId: updated.tableId,
        status: 'occupied',
      });
    }

    // Nếu hủy hoặc hoàn tất -> Trả bàn về available nếu không có ai ngồi
    if ((nextStatus === 'cancelled' || nextStatus === 'completed' || nextStatus === 'no_show') && updated.tableId) {
      const activeSession = await prisma.tableSession.findFirst({
        where: { tableId: updated.tableId, isActive: true },
      });
      if (!activeSession) {
        await prisma.table.update({
          where: { id: updated.tableId },
          data: { status: 'available' },
        });
        broadcastEvent(SocketEvents.TABLE_STATUS_CHANGED, {
          tableId: updated.tableId,
          status: 'available',
        });
      }
    }

    await AuditService.log({
      staffId,
      action: 'UPDATE_RESERVATION_STATUS',
      entity: 'Reservation',
      entityId: id,
      oldValue: { status: res.status },
      newValue: { status: nextStatus },
    });

    return updated;
  }
}
