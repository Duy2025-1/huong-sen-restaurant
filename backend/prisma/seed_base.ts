import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Comprehensive Restaurant Menu Seeding (15 Categories, 150+ Items)...');

  // 1. Ensure Branch exists
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Nhà Hàng Hoàng Gia - Royal Feast RMS',
        phone: '0901234567',
        address: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      },
    });
  }

  // 2. Ensure Roles exist
  const roleDefs = [
    { code: 'admin', name: 'Quản trị viên toàn hệ thống' },
    { code: 'manager', name: 'Quản lý chi nhánh' },
    { code: 'cashier', name: 'Thu ngân' },
    { code: 'waiter', name: 'Nhân viên phục vụ' },
    { code: 'chef', name: 'Bếp / Bar' },
  ];

  for (const r of roleDefs) {
    const existing = await prisma.role.findUnique({ where: { code: r.code } });
    if (!existing) {
      await prisma.role.create({
        data: {
          code: r.code,
          name: r.name,
          permissions: JSON.stringify(['ALL']),
        },
      });
    }
  }

  // 3. Ensure Staff users exist
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
    const existing = await prisma.staffUser.findUnique({ where: { email: s.email } });
    if (!existing) {
      await prisma.staffUser.create({
        data: {
          ...s,
          branchId: branch.id,
          passwordHash: defaultPasswordHash,
        },
      });
    }
  }

  // 4. Ensure Kitchen Stations
  const stationDefs = [
    { id: 1, name: 'Bếp Nóng (Hot Kitchen / Grill)' },
    { id: 2, name: 'Bếp Lạnh & Khai Vị (Cold Kitchen)' },
    { id: 3, name: 'Quầy Pha Chế & Tráng Miệng (Bar & Bakery)' },
  ];

  for (const st of stationDefs) {
    const existing = await prisma.kitchenStation.findUnique({ where: { id: st.id } });
    if (!existing) {
      await prisma.kitchenStation.create({
        data: {
          id: st.id,
          name: st.name,
          branchId: branch.id,
        },
      });
    }
  }

  // 5. Ensure Areas & Tables
  const areaDefs = [
    { name: 'Khu Vực Trong Nhà (Sảnh Chính)', tables: ['B01', 'B02', 'B03', 'B04', 'B05'] },
    { name: 'Khu Vực Sân Vườn Thoáng Mát', tables: ['SV-01', 'SV-02', 'SV-03', 'SV-04'] },
    { name: 'Phòng VIP Hoàng Gia', tables: ['VIP-01', 'VIP-02', 'VIP-03'] },
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

    for (const tNum of aDef.tables) {
      const existingTable = await prisma.table.findFirst({ where: { tableNumber: tNum } });
      if (!existingTable) {
        await prisma.table.create({
          data: {
            areaId: area.id,
            tableNumber: tNum,
            capacity: tNum.startsWith('VIP') ? 8 : 4,
            qrToken: `${tNum}-A9F4`,
            status: 'available',
          },
        });
      }
    }
  }

  // 6. Define 15 Comprehensive Authentic Vietnamese Categories
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

  // 7. Ensure Modifier Groups
  const modGroupsData = [
    {
      id: 1,
      name: 'Chọn Size',
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      items: [
        { name: 'Size S (Nhỏ)', additionalPrice: 0 },
        { name: 'Size M (Tiêu chuẩn)', additionalPrice: 15000 },
        { name: 'Size L (Lớn)', additionalPrice: 30000 },
      ],
    },
    {
      id: 2,
      name: 'Topping Thêm',
      isRequired: false,
      minSelect: 0,
      maxSelect: 4,
      items: [
        { name: 'Thêm Phô Mai Mozzarella', additionalPrice: 15000 },
        { name: 'Thêm Thịt Xông Khói (Bacon)', additionalPrice: 20000 },
        { name: 'Thêm Trứng Ốp La', additionalPrice: 10000 },
        { name: 'Thêm Xúc Xích Đức Nướng', additionalPrice: 20000 },
      ],
    },
    {
      id: 3,
      name: 'Mức Độ Cay',
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      items: [
        { name: 'Không Cay', additionalPrice: 0 },
        { name: 'Cay Nhẹ (Mild)', additionalPrice: 0 },
        { name: 'Cay Vừa (Medium)', additionalPrice: 0 },
        { name: 'Siêu Cay (Extra Hot)', additionalPrice: 5000 },
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
        { name: '70% Đường - 70% Đá', additionalPrice: 0 },
        { name: '50% Đường - 50% Đá', additionalPrice: 0 },
        { name: 'Không Đường - Không Đá', additionalPrice: 0 },
      ],
    },
    {
      id: 5,
      name: 'Topping Đồ Uống',
      isRequired: false,
      minSelect: 0,
      maxSelect: 3,
      items: [
        { name: 'Thêm Trân Châu Trắng Giòn', additionalPrice: 10000 },
        { name: 'Thêm Thạch Đào Giòn Sần Sật', additionalPrice: 10000 },
        { name: 'Thêm Lớp Kem Cheese Macchiato', additionalPrice: 15000 },
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

  console.log('✅ Base infrastructure, categories & modifier groups verified.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
