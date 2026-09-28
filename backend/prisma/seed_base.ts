import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Khởi tạo nền tảng Nhà Hàng Ẩm Thực Hương Sen...');

  // 1. Chi nhánh Hương Sen
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Nhà Hàng Ẩm Thực Hương Sen',
        phone: '0901234567',
        address: 'Số 18 Đường Hoa Sen, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        name: 'Nhà Hàng Ẩm Thực Hương Sen',
        phone: '0901234567',
        address: 'Số 18 Đường Hoa Sen, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      },
    });
  }

  // 2. Vai trò phân quyền (Role)
  const roleDefs = [
    { code: 'admin', name: 'Quản trị viên toàn hệ thống' },
    { code: 'manager', name: 'Quản lý chi nhánh' },
    { code: 'cashier', name: 'Thu ngân' },
    { code: 'waiter', name: 'Nhân viên phục vụ' },
    { code: 'chef', name: 'Bếp trưởng & Phụ bếp' },
  ];

  for (const r of roleDefs) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: {
        code: r.code,
        name: r.name,
        permissions: JSON.stringify(['ALL']),
      },
    });
  }

  // 3. Nhân sự nhân viên (Staff Users)
  const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
  const cashierRole = await prisma.role.findUnique({ where: { code: 'cashier' } });
  const chefRole = await prisma.role.findUnique({ where: { code: 'chef' } });
  const waiterRole = await prisma.role.findUnique({ where: { code: 'waiter' } });

  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  const staffUsers = [
    { email: 'admin@rms.com', fullName: 'Vũ Quản Trị (Admin)', phone: '0901111001', roleId: adminRole!.id },
    { email: 'cashier@rms.com', fullName: 'Lê Thu Ngân (Cashier)', phone: '0901111002', roleId: cashierRole!.id },
    { email: 'chef@rms.com', fullName: 'Trần Bếp Trưởng (Chef)', phone: '0901111003', roleId: chefRole!.id },
    { email: 'waiter@rms.com', fullName: 'Nguyễn Phục Vụ (Waiter)', phone: '0901111004', roleId: waiterRole!.id },
  ];

  for (const s of staffUsers) {
    await prisma.staffUser.upsert({
      where: { email: s.email },
      update: {
        fullName: s.fullName,
        phone: s.phone,
        roleId: s.roleId,
        passwordHash: defaultPasswordHash,
        branchId: branch.id,
      },
      create: {
        ...s,
        branchId: branch.id,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  // 4. Khách hàng thân thiết (Customers)
  const customerDefs = [
    { phone: '0912345678', fullName: 'Nguyễn Văn Hùng', email: 'hung.nguyen@gmail.com', pointBalance: 350 },
    { phone: '0987654321', fullName: 'Trần Thị Mai', email: 'mai.tran@yahoo.com', pointBalance: 120 },
    { phone: '0905123456', fullName: 'Phạm Quốc Bảo', email: 'bao.pham@outlook.com', pointBalance: 680 },
    { phone: '0938889999', fullName: 'Đỗ Hương Giang', email: 'giang.huong@gmail.com', pointBalance: 450 },
    { phone: '0977112233', fullName: 'Hoàng Kim Ngân', email: 'ngan.kim@gmail.com', pointBalance: 200 },
    { phone: '0908776655', fullName: 'Lê Thanh Tùng', email: 'tung.thanh@gmail.com', pointBalance: 890 },
  ];

  for (const c of customerDefs) {
    await prisma.customer.upsert({
      where: { phone: c.phone },
      update: { fullName: c.fullName, email: c.email, pointBalance: c.pointBalance },
      create: { phone: c.phone, fullName: c.fullName, email: c.email, pointBalance: c.pointBalance },
    });
  }

  // 5. Trạm bếp KDS (Kitchen Stations)
  const stationDefs = [
    { id: 1, name: 'Bếp Nóng & Món Chiên Xào' },
    { id: 2, name: 'Bếp Lạnh, Gỏi & Khai Vị' },
    { id: 3, name: 'Bếp Nướng & Món Kho' },
    { id: 4, name: 'Bếp Canh & Nước Lẩu' },
    { id: 5, name: 'Quầy Pha Chế & Tráng Miệng' },
  ];

  for (const st of stationDefs) {
    await prisma.kitchenStation.upsert({
      where: { id: st.id },
      update: { name: st.name },
      create: {
        id: st.id,
        name: st.name,
        branchId: branch.id,
      },
    });
  }

  // 6. Khu vực & 22 Bàn ăn (Areas & Tables)
  const areaDefs = [
    {
      name: 'Sảnh Mộc (Tầng Trệt)',
      tables: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10'],
      capacity: 4,
    },
    {
      name: 'Hiên Sen Thoáng Mát',
      tables: ['H01', 'H02', 'H03', 'H04', 'H05', 'H06'],
      capacity: 6,
    },
    {
      name: 'Phòng VIP Hương Sen',
      tables: ['VIP-01', 'VIP-02', 'VIP-03', 'VIP-04', 'VIP-05', 'VIP-06'],
      capacity: 10,
    },
  ];

  for (let aIdx = 0; aIdx < areaDefs.length; aIdx++) {
    const aDef = areaDefs[aIdx];
    let area = await prisma.area.findFirst({ where: { name: aDef.name } });
    if (!area) {
      area = await prisma.area.create({
        data: {
          name: aDef.name,
          branchId: branch.id,
          displayOrder: aIdx + 1,
        },
      });
    }

    for (let tIdx = 0; tIdx < aDef.tables.length; tIdx++) {
      const tNum = aDef.tables[tIdx];
      const existingTable = await prisma.table.findFirst({ where: { tableNumber: tNum } });
      const qrToken = `${tNum}-HS${(1000 + tIdx * 37).toString(16).toUpperCase()}`;

      if (!existingTable) {
        await prisma.table.create({
          data: {
            areaId: area.id,
            tableNumber: tNum,
            capacity: aDef.capacity,
            qrToken,
            status: 'available',
            posX: (tIdx % 5) * 120,
            posY: Math.floor(tIdx / 5) * 120,
          },
        });
      } else {
        await prisma.table.update({
          where: { id: existingTable.id },
          data: {
            areaId: area.id,
            capacity: aDef.capacity,
            qrToken,
            status: 'available',
          },
        });
      }
    }
  }

  // 7. 15 Danh mục ẩm thực Việt Nam Hương Sen
  const categoryDefs = [
    { id: 1, name: 'Khai Vị', slug: 'khai-vi', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80', displayOrder: 1 },
    { id: 2, name: 'Gỏi & Nộm', slug: 'goi-nom', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80', displayOrder: 2 },
    { id: 3, name: 'Canh & Món Nước', slug: 'canh-mon-nuoc', imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&q=80', displayOrder: 3 },
    { id: 4, name: 'Món Gà', slug: 'mon-ga', imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&q=80', displayOrder: 4 },
    { id: 5, name: 'Món Bò', slug: 'mon-bo', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', displayOrder: 5 },
    { id: 6, name: 'Món Heo', slug: 'mon-heo', imageUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&q=80', displayOrder: 6 },
    { id: 7, name: 'Hải Sản', slug: 'hai-san', imageUrl: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=600&q=80', displayOrder: 7 },
    { id: 8, name: 'Món Xào', slug: 'mon-xao', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80', displayOrder: 8 },
    { id: 9, name: 'Món Kho', slug: 'mon-kho', imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80', displayOrder: 9 },
    { id: 10, name: 'Cơm', slug: 'com', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80', displayOrder: 10 },
    { id: 11, name: 'Món Quê', slug: 'mon-que', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80', displayOrder: 11 },
    { id: 12, name: 'Lẩu', slug: 'lau', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80', displayOrder: 12 },
    { id: 13, name: 'Món Chay', slug: 'mon-chay', imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80', displayOrder: 13 },
    { id: 14, name: 'Đồ Uống', slug: 'do-uong', imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80', displayOrder: 14 },
    { id: 15, name: 'Tráng Miệng', slug: 'trang-mieng', imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80', displayOrder: 15 },
  ];

  for (const c of categoryDefs) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        displayOrder: c.displayOrder,
      },
      create: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        displayOrder: c.displayOrder,
      },
    });
  }

  // 8. Tùy chọn món (Modifier Groups)
  const modGroupsData = [
    {
      id: 1,
      name: 'Chọn Khẩu Vị / Phần Ăn',
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      items: [
        { name: 'Phần Tiêu Chuẩn', additionalPrice: 0 },
        { name: 'Phần Lớn (+50% khẩu phần)', additionalPrice: 35000 },
      ],
    },
    {
      id: 2,
      name: 'Ăn Kèm Thêm',
      isRequired: false,
      minSelect: 0,
      maxSelect: 3,
      items: [
        { name: 'Thêm Đĩa Bún Tươi', additionalPrice: 15000 },
        { name: 'Thêm Bánh Mì Nóng Giòn', additionalPrice: 10000 },
        { name: 'Thêm Đĩa Rau Muống Nhúng Lẩu', additionalPrice: 20000 },
        { name: 'Thêm Trứng Gà Ta', additionalPrice: 10000 },
      ],
    },
    {
      id: 3,
      name: 'Độ Cay Món Ăn',
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      items: [
        { name: 'Không Cay (Trẻ em dùng được)', additionalPrice: 0 },
        { name: 'Cay Vừa (Vị chuẩn Hương Sen)', additionalPrice: 0 },
        { name: 'Cay Nhiều (Thêm ớt hiểm cay nồng)', additionalPrice: 0 },
      ],
    },
    {
      id: 4,
      name: 'Lượng Đường & Đá (Đồ Uống)',
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      items: [
        { name: '100% Đường - 100% Đá', additionalPrice: 0 },
        { name: '70% Đường - Ít Đá', additionalPrice: 0 },
        { name: '50% Đường - Đá Bình Thường', additionalPrice: 0 },
        { name: 'Không Đường - Không Đá', additionalPrice: 0 },
      ],
    },
    {
      id: 5,
      name: 'Topping Đồ Uống & Tráng Miệng',
      isRequired: false,
      minSelect: 0,
      maxSelect: 3,
      items: [
        { name: 'Thêm Hạt Sen Nấu Đường Phèn', additionalPrice: 15000 },
        { name: 'Thêm Thạch Nha Đam Tươi', additionalPrice: 10000 },
        { name: 'Thêm Sương Sáo Cốt Dừa', additionalPrice: 12000 },
      ],
    },
  ];

  for (const mg of modGroupsData) {
    const group = await prisma.modifierGroup.upsert({
      where: { id: mg.id },
      update: {
        name: mg.name,
        isRequired: mg.isRequired,
        minSelect: mg.minSelect,
        maxSelect: mg.maxSelect,
      },
      create: {
        id: mg.id,
        name: mg.name,
        isRequired: mg.isRequired,
        minSelect: mg.minSelect,
        maxSelect: mg.maxSelect,
      },
    });

    for (const it of mg.items) {
      const existingItem = await prisma.modifierItem.findFirst({
        where: { groupId: group.id, name: it.name },
      });
      if (!existingItem) {
        await prisma.modifierItem.create({
          data: {
            groupId: group.id,
            name: it.name,
            additionalPrice: it.additionalPrice,
          },
        });
      }
    }
  }

  // 9. Mã khuyến mãi (Promotions)
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const promoDefs = [
    {
      code: 'SENXANH10',
      name: 'Ưu Đãi Hương Sen Xanh 10%',
      description: 'Giảm 10% tối đa 100.000đ cho đơn hàng từ 250.000đ',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderAmount: 250000,
      maxDiscountAmount: 100000,
      usageLimit: 500,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: nextMonth,
    },
    {
      code: 'HUONGSEN50K',
      name: 'Tri Ân Thực Khách 50.000đ',
      description: 'Giảm ngay 50.000đ trực tiếp cho hóa đơn dùng bữa từ 500.000đ',
      discountType: 'FIXED',
      discountValue: 50000,
      minOrderAmount: 500000,
      maxDiscountAmount: 50000,
      usageLimit: 300,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: nextMonth,
    },
    {
      code: 'VIPTIEC',
      name: 'Đại Tiệc VIP Hương Sen 15%',
      description: 'Giảm 15% tối đa 500.000đ cho tiệc đặt phòng VIP từ 1.500.000đ',
      discountType: 'PERCENT',
      discountValue: 15,
      minOrderAmount: 1500000,
      maxDiscountAmount: 500000,
      usageLimit: 100,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: nextMonth,
    },
  ];

  for (const p of promoDefs) {
    await prisma.promotion.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        discountType: p.discountType,
        discountValue: p.discountValue,
        minOrderAmount: p.minOrderAmount,
        maxDiscountAmount: p.maxDiscountAmount,
        startDate: p.startDate,
        endDate: p.endDate,
        isActive: p.isActive,
      },
      create: p,
    });
  }

  console.log('✅ Hoàn tất thiết lập nền tảng: Chi nhánh Hương Sen, 5 Vai trò, 4 Tài khoản, 6 Khách hàng, 5 Trạm bếp, 22 Bàn ăn, 15 Danh mục, Tùy chọn & Khuyến mãi.');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed nền tảng:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
