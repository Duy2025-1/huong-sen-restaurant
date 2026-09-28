import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Bắt đầu khởi tạo dữ liệu Đơn hàng, Phiên bàn, Doanh thu thực tế & Đặt bàn...');

  const branch = await prisma.branch.findFirst();
  if (!branch) throw new Error('Chưa có chi nhánh');

  const cashier = await prisma.staffUser.findFirst({ where: { email: 'cashier@rms.com' } });
  const waiter = await prisma.staffUser.findFirst({ where: { email: 'waiter@rms.com' } });
  const chef = await prisma.staffUser.findFirst({ where: { email: 'chef@rms.com' } });

  const customers = await prisma.customer.findMany();
  const tables = await prisma.table.findMany({ include: { area: true } });
  const dishes = await prisma.dish.findMany();

  if (tables.length === 0 || dishes.length === 0) {
    throw new Error('Chưa có danh sách bàn hoặc món ăn.');
  }

  // Clear existing orders, payments, sessions, reservations, tickets to prevent duplicates during seed re-runs
  await prisma.review.deleteMany({});
  await prisma.paymentTransaction.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.orderItemModifier.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.kitchenTicket.deleteMany({});
  await prisma.promotionUsage.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.tableSession.deleteMany({});
  await prisma.reservation.deleteMany({});

  // Reset table statuses to default
  await prisma.table.updateMany({ data: { status: 'available' } });

  const now = new Date();
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  const vnNow = new Date(now.getTime() + vnOffsetMs);
  const currentYear = vnNow.getUTCFullYear();
  const currentMonth = vnNow.getUTCMonth();
  const currentDay = vnNow.getUTCDate();

  // Helper tạo ngày giờ theo giờ Việt Nam
  function makeVnDate(daysAgo: number, hour: number, minute: number): Date {
    const d = new Date(Date.UTC(currentYear, currentMonth, currentDay - daysAgo, hour, minute, 0, 0));
    return new Date(d.getTime() - vnOffsetMs);
  }

  // Map món ăn theo category để chọn món hợp lý
  const khaiVi = dishes.filter((d) => d.categoryId === 1);
  const goi = dishes.filter((d) => d.categoryId === 2);
  const ga = dishes.filter((d) => d.categoryId === 4);
  const bo = dishes.filter((d) => d.categoryId === 5);
  const com = dishes.filter((d) => d.categoryId === 10);
  const lau = dishes.filter((d) => d.categoryId === 12);
  const doUong = dishes.filter((d) => d.categoryId === 14);
  const trangMieng = dishes.filter((d) => d.categoryId === 15);

  let orderSequence = 1;

  // 1. Tạo đơn hàng 6 ngày trước (quá khứ) để có dữ liệu phân tích và biểu đồ lịch sử
  console.log('⏳ Khởi tạo dữ liệu lịch sử đơn hàng 6 ngày qua...');
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    const orderTimes = [
      { h: 11, m: 15 },
      { h: 11, m: 45 },
      { h: 12, m: 10 },
      { h: 12, m: 35 },
      { h: 13, m: 0 },
      { h: 13, m: 30 },
      { h: 18, m: 10 },
      { h: 18, m: 40 },
      { h: 19, m: 15 },
      { h: 19, m: 45 },
      { h: 20, m: 10 },
    ];

    for (let i = 0; i < orderTimes.length; i++) {
      const ot = orderTimes[i];
      const orderDate = makeVnDate(daysAgo, ot.h, ot.m);
      const table = tables[(i + daysAgo * 3) % tables.length];
      const customer = customers.length > 0 ? customers[(i + daysAgo) % customers.length] : null;

      // Chọn 3-5 món
      const selectedDishes = [
        khaiVi[i % khaiVi.length] || dishes[0],
        ga[(i + 1) % ga.length] || dishes[1],
        com[(i + 2) % com.length] || dishes[2],
        doUong[(i + 3) % doUong.length] || dishes[3],
      ];
      if (i % 2 === 0 && lau.length > 0) {
        selectedDishes.push(lau[i % lau.length]);
      }

      // Tạo Session
      const sessionToken = `SES-${orderDate.getTime()}-${table.id}`;
      const session = await prisma.tableSession.create({
        data: {
          tableId: table.id,
          sessionToken,
          guestCount: table.capacity >= 8 ? 6 : 3,
          openedById: waiter?.id || null,
          openedAt: new Date(orderDate.getTime() - 5 * 60000),
          closedAt: new Date(orderDate.getTime() + 65 * 60000),
          isActive: false,
          status: 'closed',
        },
      });

      // Tính tổng tiền
      let subtotal = 0;
      const itemCreates = selectedDishes.map((d, dIdx) => {
        const qty = dIdx === 3 ? 2 : 1;
        const price = d.price;
        const total = price * qty;
        subtotal += total;

        const prepDurationMinutes = 10 + (d.id % 5); // 10 - 14 phút
        const cookingAt = new Date(orderDate.getTime() + 2 * 60000);
        const readyAt = new Date(cookingAt.getTime() + prepDurationMinutes * 60000);
        const servedAt = new Date(readyAt.getTime() + 2 * 60000);

        return {
          dishId: d.id,
          stationId: d.stationId || 1,
          dishNameSnapshot: d.name,
          quantity: qty,
          unitPrice: price,
          modifiersPrice: 0,
          totalPrice: total,
          status: 'served',
          roundNumber: 1,
          cookingAt,
          readyAt,
          servedAt,
        };
      });

      const orderCode = `HS-${orderDate.toISOString().slice(0, 10).replace(/-/g, '')}-${(1000 + orderSequence).toString()}`;
      orderSequence++;

      const order = await prisma.order.create({
        data: {
          code: orderCode,
          branchId: branch.id,
          sessionId: session.id,
          tableId: table.id,
          customerId: customer?.id || null,
          createdById: waiter?.id || null,
          orderType: 'dine_in',
          status: 'completed',
          paymentStatus: 'paid',
          subtotalAmount: subtotal,
          discountAmount: 0,
          taxAmount: 0,
          deliveryFee: 0,
          totalAmount: subtotal,
          customerName: customer?.fullName || `Khách bàn ${table.tableNumber}`,
          customerPhone: customer?.phone || null,
          createdAt: orderDate,
          updatedAt: new Date(orderDate.getTime() + 60 * 60000),
          orderItems: {
            create: itemCreates,
          },
        },
      });

      // Tạo Payment
      const methods = ['cash', 'vnpay', 'card', 'transfer'];
      await prisma.payment.create({
        data: {
          orderId: order.id,
          cashierId: cashier?.id || null,
          method: methods[i % methods.length],
          amount: subtotal,
          paymentStatus: 'paid',
          transactionCode: `PAY-${order.code}`,
          createdAt: new Date(orderDate.getTime() + 55 * 60000),
        },
      });

      // Ghi nhận Status History
      await prisma.orderStatusHistory.createMany({
        data: [
          { orderId: order.id, fromStatus: null, toStatus: 'pending', createdAt: orderDate },
          { orderId: order.id, fromStatus: 'pending', toStatus: 'confirmed', createdAt: new Date(orderDate.getTime() + 60000) },
          { orderId: order.id, fromStatus: 'confirmed', toStatus: 'preparing', createdAt: new Date(orderDate.getTime() + 2 * 60000) },
          { orderId: order.id, fromStatus: 'preparing', toStatus: 'ready', createdAt: new Date(orderDate.getTime() + 14 * 60000) },
          { orderId: order.id, fromStatus: 'ready', toStatus: 'served', createdAt: new Date(orderDate.getTime() + 16 * 60000) },
          { orderId: order.id, fromStatus: 'served', toStatus: 'completed', createdAt: new Date(orderDate.getTime() + 55 * 60000) },
        ],
      });
    }
  }

  // 2. Tạo đơn hàng HÔM NAY (Today) phân bổ theo khung giờ thực tế:
  // 10:00 (8h-10h), 12:00 (10h-12h), 14:00 (12h-14h), 16:00 (14h-16h)
  console.log('☀️ Khởi tạo dữ liệu ĐƠN HÀNG HÔM NAY theo đúng giờ thực tế...');
  const todayOrderTimes = [
    { h: 9, m: 20, tableIdx: 10, dishesIdx: [0, 93], guestCount: 2 }, // 09:20 sáng: Trà / Cà phê (Khung 10:00)
    { h: 10, m: 30, tableIdx: 0, dishesIdx: [1, 57, 93], guestCount: 2 }, // Khung 12:00
    { h: 11, m: 15, tableIdx: 1, dishesIdx: [0, 10, 57, 94], guestCount: 4 }, // Khung 12:00
    { h: 11, m: 40, tableIdx: 2, dishesIdx: [2, 18, 42, 94], guestCount: 3 }, // Khung 12:00
    { h: 11, m: 55, tableIdx: 3, dishesIdx: [0, 35, 42, 57], guestCount: 4 }, // Khung 12:00
    { h: 12, m: 15, tableIdx: 16, dishesIdx: [0, 1, 10, 18, 73, 94], guestCount: 8 }, // VIP tiệc (Khung 14:00)
    { h: 12, m: 35, tableIdx: 4, dishesIdx: [2, 26, 42, 57], guestCount: 3 }, // Khung 14:00
    { h: 12, m: 50, tableIdx: 5, dishesIdx: [0, 18, 93], guestCount: 2 }, // Khung 14:00
    { h: 13, m: 15, tableIdx: 6, dishesIdx: [1, 10, 42, 94], guestCount: 3 }, // Khung 14:00
    { h: 13, m: 45, tableIdx: 11, dishesIdx: [0, 57, 105], guestCount: 2 }, // Khung 14:00
    { h: 14, m: 20, tableIdx: 12, dishesIdx: [93, 94, 105], guestCount: 2 }, // Tráng miệng chiều (Khung 16:00)
    { h: 15, m: 10, tableIdx: 7, dishesIdx: [0, 1, 94], guestCount: 2 }, // Khung 16:00
  ];

  for (let idx = 0; idx < todayOrderTimes.length; idx++) {
    const tot = todayOrderTimes[idx];
    const orderDate = makeVnDate(0, tot.h, tot.m);
    const table = tables[tot.tableIdx % tables.length];
    const customer = customers[idx % customers.length];

    const sessionToken = `SES-TODAY-${orderDate.getTime()}-${table.id}`;
    const session = await prisma.tableSession.create({
      data: {
        tableId: table.id,
        sessionToken,
        guestCount: tot.guestCount,
        openedById: waiter?.id || null,
        openedAt: new Date(orderDate.getTime() - 5 * 60000),
        closedAt: new Date(orderDate.getTime() + 45 * 60000),
        isActive: false,
        status: 'closed',
      },
    });

    let subtotal = 0;
    const itemCreates = tot.dishesIdx.map((dIndex) => {
      const d = dishes[dIndex % dishes.length];
      const qty = 1;
      const price = d.price;
      const total = price * qty;
      subtotal += total;

      // Chuẩn hóa thời gian chế biến từ 11 đến 13 phút để phản ánh tốc độ KDS chuẩn
      const prepDuration = 11 + (d.id % 3); // 11, 12 hoặc 13 phút
      const cookingAt = new Date(orderDate.getTime() + 2 * 60000);
      const readyAt = new Date(cookingAt.getTime() + prepDuration * 60000);
      const servedAt = new Date(readyAt.getTime() + 2 * 60000);

      return {
        dishId: d.id,
        stationId: d.stationId || 1,
        dishNameSnapshot: d.name,
        quantity: qty,
        unitPrice: price,
        modifiersPrice: 0,
        totalPrice: total,
        status: 'served',
        roundNumber: 1,
        cookingAt,
        readyAt,
        servedAt,
      };
    });

    const orderCode = `HS-${orderDate.toISOString().slice(0, 10).replace(/-/g, '')}-${(1000 + orderSequence).toString()}`;
    orderSequence++;

    const order = await prisma.order.create({
      data: {
        code: orderCode,
        branchId: branch.id,
        sessionId: session.id,
        tableId: table.id,
        customerId: customer?.id || null,
        createdById: waiter?.id || null,
        orderType: 'dine_in',
        status: 'completed',
        paymentStatus: 'paid',
        subtotalAmount: subtotal,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: 0,
        totalAmount: subtotal,
        customerName: customer?.fullName || `Khách bàn ${table.tableNumber}`,
        customerPhone: customer?.phone || null,
        createdAt: orderDate,
        updatedAt: new Date(orderDate.getTime() + 45 * 60000),
        orderItems: {
          create: itemCreates,
        },
      },
    });

    const methods = ['vnpay', 'cash', 'card', 'transfer'];
    await prisma.payment.create({
      data: {
        orderId: order.id,
        cashierId: cashier?.id || null,
        method: methods[idx % methods.length],
        amount: subtotal,
        paymentStatus: 'paid',
        transactionCode: `PAY-${order.code}`,
        createdAt: new Date(orderDate.getTime() + 42 * 60000),
      },
    });

    await prisma.orderStatusHistory.createMany({
      data: [
        { orderId: order.id, fromStatus: null, toStatus: 'pending', createdAt: orderDate },
        { orderId: order.id, fromStatus: 'pending', toStatus: 'confirmed', createdAt: new Date(orderDate.getTime() + 60000) },
        { orderId: order.id, fromStatus: 'confirmed', toStatus: 'preparing', createdAt: new Date(orderDate.getTime() + 2 * 60000) },
        { orderId: order.id, fromStatus: 'preparing', toStatus: 'ready', createdAt: new Date(orderDate.getTime() + 14 * 60000) },
        { orderId: order.id, fromStatus: 'ready', toStatus: 'served', createdAt: new Date(orderDate.getTime() + 16 * 60000) },
        { orderId: order.id, fromStatus: 'served', toStatus: 'completed', createdAt: new Date(orderDate.getTime() + 42 * 60000) },
      ],
    });
  }

  // 3. TẠO CÁC BÀN ĐANG PHỤC VỤ TRỰC TIẾP (LIVE ACTIVE TABLES NGAY LÚC NÀY)
  console.log('🔴 Khởi tạo bàn & phiên ăn đang hoạt động trực tiếp (Occupied, Cleaning, Reserved)...');
  const tableB01 = tables.find((t) => t.tableNumber === 'B01') || tables[0];
  const tableB02 = tables.find((t) => t.tableNumber === 'B02') || tables[1];
  const tableB04 = tables.find((t) => t.tableNumber === 'B04') || tables[3];
  const tableVIP01 = tables.find((t) => t.tableNumber === 'VIP-01') || tables[tables.length - 1];

  // Bàn B01: Đang ăn, trạng thái đơn 'preparing' (Bếp đang nấu)
  const sessionB01 = await prisma.tableSession.create({
    data: {
      tableId: tableB01.id,
      sessionToken: `SES-LIVE-${tableB01.tableNumber}-${Date.now()}`,
      guestCount: 3,
      openedById: waiter?.id || null,
      openedAt: new Date(Date.now() - 15 * 60000),
      isActive: true,
      status: 'active',
    },
  });
  await prisma.table.update({
    where: { id: tableB01.id },
    data: { status: 'occupied' },
  });

  const liveOrderB01Code = `HS-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${(1000 + orderSequence++).toString()}`;
  const d1 = dishes[0]; // Chả giò
  const d2 = dishes[17]; // Bò tơ nướng tảng
  const d3 = dishes[56]; // Cơm chiên hạt sen
  const subB01 = d1.price + d2.price + d3.price;

  await prisma.order.create({
    data: {
      code: liveOrderB01Code,
      branchId: branch.id,
      sessionId: sessionB01.id,
      tableId: tableB01.id,
      createdById: waiter?.id || null,
      orderType: 'dine_in',
      status: 'preparing',
      paymentStatus: 'unpaid',
      subtotalAmount: subB01,
      totalAmount: subB01,
      customerName: 'Anh Tuấn (Bàn B01)',
      customerPhone: '0909112233',
      createdAt: new Date(Date.now() - 10 * 60000),
      orderItems: {
        create: [
          {
            dishId: d1.id,
            stationId: d1.stationId || 2,
            dishNameSnapshot: d1.name,
            quantity: 1,
            unitPrice: d1.price,
            totalPrice: d1.price,
            status: 'cooking',
            cookingAt: new Date(Date.now() - 8 * 60000),
          },
          {
            dishId: d2.id,
            stationId: d2.stationId || 1,
            dishNameSnapshot: d2.name,
            quantity: 1,
            unitPrice: d2.price,
            totalPrice: d2.price,
            status: 'cooking',
            cookingAt: new Date(Date.now() - 7 * 60000),
          },
          {
            dishId: d3.id,
            stationId: d3.stationId || 1,
            dishNameSnapshot: d3.name,
            quantity: 1,
            unitPrice: d3.price,
            totalPrice: d3.price,
            status: 'pending',
          },
        ],
      },
    },
  });

  // Bàn B02: Đã phục vụ đủ món, khách đang dùng bữa, chờ thanh toán
  const sessionB02 = await prisma.tableSession.create({
    data: {
      tableId: tableB02.id,
      sessionToken: `SES-LIVE-${tableB02.tableNumber}-${Date.now()}`,
      guestCount: 2,
      openedById: waiter?.id || null,
      openedAt: new Date(Date.now() - 35 * 60000),
      isActive: true,
      status: 'active',
    },
  });
  await prisma.table.update({
    where: { id: tableB02.id },
    data: { status: 'occupied' },
  });

  const liveOrderB02Code = `HS-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${(1000 + orderSequence++).toString()}`;
  const g1 = dishes[1]; // Gỏi cuốn
  const g2 = dishes[93]; // Trà sen
  const subB02 = g1.price * 2 + g2.price * 2;

  await prisma.order.create({
    data: {
      code: liveOrderB02Code,
      branchId: branch.id,
      sessionId: sessionB02.id,
      tableId: tableB02.id,
      createdById: waiter?.id || null,
      orderType: 'dine_in',
      status: 'served',
      paymentStatus: 'unpaid',
      subtotalAmount: subB02,
      totalAmount: subB02,
      customerName: 'Chị Lan (Bàn B02)',
      customerPhone: '0918776655',
      createdAt: new Date(Date.now() - 30 * 60000),
      orderItems: {
        create: [
          {
            dishId: g1.id,
            stationId: g1.stationId || 2,
            dishNameSnapshot: g1.name,
            quantity: 2,
            unitPrice: g1.price,
            totalPrice: g1.price * 2,
            status: 'served',
            cookingAt: new Date(Date.now() - 28 * 60000),
            readyAt: new Date(Date.now() - 18 * 60000),
            servedAt: new Date(Date.now() - 16 * 60000),
          },
          {
            dishId: g2.id,
            stationId: g2.stationId || 5,
            dishNameSnapshot: g2.name,
            quantity: 2,
            unitPrice: g2.price,
            totalPrice: g2.price * 2,
            status: 'served',
            cookingAt: new Date(Date.now() - 28 * 60000),
            readyAt: new Date(Date.now() - 22 * 60000),
            servedAt: new Date(Date.now() - 20 * 60000),
          },
        ],
      },
    },
  });

  // Bàn B04: Đang dọn dẹp vệ sinh (cleaning)
  await prisma.table.update({
    where: { id: tableB04.id },
    data: { status: 'cleaning' },
  });

  // Bàn VIP-01: Đã đặt trước cho tối nay (reserved)
  await prisma.table.update({
    where: { id: tableVIP01.id },
    data: { status: 'reserved' },
  });

  // 4. KHỞI TẠO ĐẶT BÀN (RESERVATIONS)
  console.log('📅 Khởi tạo danh sách Đặt bàn trước (Reservations)...');
  const tonightVipTime = makeVnDate(0, 18, 30);
  const tonightB5Time = makeVnDate(0, 19, 0);
  const tomorrowVipTime = makeVnDate(-1, 12, 0);

  await prisma.reservation.createMany({
    data: [
      {
        code: `RES-${now.toISOString().slice(0, 10).replace(/-/g, '')}-001`,
        branchId: branch.id,
        tableId: tableVIP01.id,
        customerName: 'Nguyễn Văn Hùng',
        customerPhone: '0912345678',
        guestCount: 10,
        reservationTime: tonightVipTime,
        endTime: new Date(tonightVipTime.getTime() + 2 * 3600000),
        status: 'confirmed',
        depositAmount: 500000,
        note: 'Tiệc sinh nhật gia đình tại VIP Hương Sen, chuẩn bị sẵn hoa tươi.',
      },
      {
        code: `RES-${now.toISOString().slice(0, 10).replace(/-/g, '')}-002`,
        branchId: branch.id,
        tableId: tables[4].id,
        customerName: 'Đỗ Hương Giang',
        customerPhone: '0938889999',
        guestCount: 4,
        reservationTime: tonightB5Time,
        endTime: new Date(tonightB5Time.getTime() + 2 * 3600000),
        status: 'confirmed',
        depositAmount: 0,
        note: 'Bàn view vườn sen thoáng mát.',
      },
      {
        code: `RES-${now.toISOString().slice(0, 10).replace(/-/g, '')}-003`,
        branchId: branch.id,
        tableId: tables[17].id,
        customerName: 'Hoàng Kim Ngân',
        customerPhone: '0977112233',
        guestCount: 8,
        reservationTime: tomorrowVipTime,
        endTime: new Date(tomorrowVipTime.getTime() + 2 * 3600000),
        status: 'pending',
        depositAmount: 0,
        note: 'Gặp gỡ đối tác kinh doanh trưa mai.',
      },
    ],
  });

  // 5. ĐÁNH GIÁ THỰC KHÁCH ĐÃ XÁC THỰC MUA HÀNG (REVIEWS)
  console.log('⭐ Khởi tạo đánh giá khách hàng (Verified Reviews)...');
  const completedOrders = await prisma.order.findMany({
    where: { status: 'completed' },
    include: { orderItems: true },
    take: 12,
  });

  const reviewComments = [
    'Món ăn rất tươi ngon, đậm đà phong vị quê hương. Chả giò giòn rụm nhân tôm thịt đầy đặn!',
    'Không gian nhà hàng Hương Sen rất ấm cúng và thanh tao. Món gà hấp lá chanh thịt ngọt săn chắc.',
    'Bò tơ nướng thơm lừng, thịt mềm không hề dai. Nhân viên phục vụ rất chu đáo và thân thiện.',
    'Cơm chiên hạt sen thơm dịu mùi lá sen tươi. Rất ưng ý, cả nhà mình ai cũng khen tấm tắc.',
    'Lẩu riêu cua đồng nước dùng ngọt thanh, riêu cua béo ngậy. Sẽ quay lại ủng hộ nhà hàng nhiều lần!',
    'Trà sen Tây Hồ thơm ngát, uống vào thanh mát dễ chịu. Món ăn lên nhanh, đóng gói chỉn chu.',
  ];

  for (let rIdx = 0; rIdx < completedOrders.length; rIdx++) {
    const o = completedOrders[rIdx];
    if (o.orderItems.length === 0) continue;
    const item = o.orderItems[0];

    await prisma.review.create({
      data: {
        dishId: item.dishId,
        orderId: o.id,
        customerId: o.customerId || null,
        userName: o.customerName || 'Thực khách Hương Sen',
        rating: 5,
        comment: reviewComments[rIdx % reviewComments.length],
        verifiedPurchase: true,
        helpfulCount: 3 + (rIdx % 5),
      },
    });
  }

  console.log('✅ Hoàn tất khởi tạo toàn bộ Đơn hàng, Phiên bàn, Doanh thu thực tế, Trạng thái bàn & Đặt bàn.');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed đơn hàng:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
