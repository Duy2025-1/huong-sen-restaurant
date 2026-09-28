import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌾 Bắt đầu khởi tạo Kho nguyên liệu & Công thức định lượng Hương Sen...');

  const branch = await prisma.branch.findFirst();
  if (!branch) {
    throw new Error('Chưa tìm thấy chi nhánh Hương Sen. Hãy chạy seed_base.ts trước.');
  }

  const admin = await prisma.staffUser.findFirst({ where: { email: 'admin@rms.com' } });

  // 1. Danh sách 24 Nguyên liệu kho thực tế
  const ingredientsData = [
    { code: 'ING-GATA', name: 'Gà ta thả vườn tươi sống', unit: 'kg', minStock: 20, costPrice: 95000, currentStock: 80 },
    { code: 'ING-BOTO', name: 'Bò tơ Củ Chi tươi', unit: 'kg', minStock: 15, costPrice: 220000, currentStock: 45 },
    { code: 'ING-TOMSU', name: 'Tôm sú tươi sống Cà Mau', unit: 'kg', minStock: 15, costPrice: 290000, currentStock: 40 },
    { code: 'ING-CALOC', name: 'Cá lóc đồng tươi', unit: 'kg', minStock: 10, costPrice: 95000, currentStock: 35 },
    { code: 'ING-GAOST25', name: 'Gạo đặc sản ST25 Sóc Trăng', unit: 'kg', minStock: 50, costPrice: 32000, currentStock: 200 },
    { code: 'ING-HATSEN', name: 'Hạt sen tươi Đồng Tháp', unit: 'kg', minStock: 10, costPrice: 125000, currentStock: 30 },
    { code: 'ING-NGOSEN', name: 'Ngó sen tươi làm sạch', unit: 'kg', minStock: 10, costPrice: 45000, currentStock: 25 },
    { code: 'ING-THITBACHI', name: 'Thịt ba chỉ heo sạch VietGAP', unit: 'kg', minStock: 20, costPrice: 115000, currentStock: 65 },
    { code: 'ING-SUONHEO', name: 'Sườn non heo sạch', unit: 'kg', minStock: 15, costPrice: 155000, currentStock: 40 },
    { code: 'ING-CUABIEN', name: 'Cua biển Cà Mau', unit: 'kg', minStock: 8, costPrice: 380000, currentStock: 22 },
    { code: 'ING-CUADONG', name: 'Cua đồng tươi giã nhuyễn', unit: 'kg', minStock: 10, costPrice: 110000, currentStock: 30 },
    { code: 'ING-MUCONG', name: 'Mực ống câu Phú Quốc', unit: 'kg', minStock: 12, costPrice: 240000, currentStock: 35 },
    { code: 'ING-RAUMUONG', name: 'Rau muống đồng tươi giòn', unit: 'kg', minStock: 15, costPrice: 15000, currentStock: 45 },
    { code: 'ING-NAMDONGCO', name: 'Nấm đông cô tươi & Nấm rơm', unit: 'kg', minStock: 8, costPrice: 85000, currentStock: 25 },
    { code: 'ING-DAUHU', name: 'Đậu hũ non sạch', unit: 'kg', minStock: 10, costPrice: 20000, currentStock: 30 },
    { code: 'ING-RAUSONG', name: 'Rau sống thảo mộc đồng quê', unit: 'kg', minStock: 20, costPrice: 25000, currentStock: 50 },
    { code: 'ING-BUNTUOI', name: 'Bún tươi sợi nhỏ Thủ Đức', unit: 'kg', minStock: 25, costPrice: 16000, currentStock: 60 },
    { code: 'ING-BANHTRANG', name: 'Bánh tráng rế & phơi sương', unit: 'gói', minStock: 30, costPrice: 18000, currentStock: 80 },
    { code: 'ING-NUOCMAM', name: 'Nước mắm nhĩ Phú Quốc 40N', unit: 'lít', minStock: 20, costPrice: 85000, currentStock: 60 },
    { code: 'ING-DAUAN', name: 'Dầu thực vật dinh dưỡng', unit: 'lít', minStock: 30, costPrice: 38000, currentStock: 90 },
    { code: 'ING-DUONGPHEN', name: 'Đường phèn Quảng Ngãi', unit: 'kg', minStock: 15, costPrice: 28000, currentStock: 50 },
    { code: 'ING-CAPHE', name: 'Cà phê Robusta mộc Đắk Lắk', unit: 'kg', minStock: 10, costPrice: 140000, currentStock: 30 },
    { code: 'ING-TRASEN', name: 'Trà sen Tây Hồ ướp bông tươi', unit: 'kg', minStock: 5, costPrice: 380000, currentStock: 15 },
    { code: 'ING-SUADAC', name: 'Sữa đặc có đường Ông Thọ', unit: 'lon', minStock: 24, costPrice: 22000, currentStock: 72 },
  ];

  const ingMap = new Map<string, number>();

  for (const ing of ingredientsData) {
    const upserted = await prisma.ingredient.upsert({
      where: { code: ing.code },
      update: {
        name: ing.name,
        unit: ing.unit,
        minStock: ing.minStock,
        costPrice: ing.costPrice,
        currentStock: ing.currentStock,
        branchId: branch.id,
      },
      create: {
        branchId: branch.id,
        code: ing.code,
        name: ing.name,
        unit: ing.unit,
        minStock: ing.minStock,
        costPrice: ing.costPrice,
        currentStock: ing.currentStock,
      },
    });

    ingMap.set(ing.code, upserted.id);

    // Ghi nhận giao dịch nhập kho ban đầu nếu chưa có
    const txCount = await prisma.inventoryTransaction.count({
      where: { ingredientId: upserted.id },
    });
    if (txCount === 0) {
      await prisma.inventoryTransaction.create({
        data: {
          ingredientId: upserted.id,
          staffId: admin?.id || null,
          type: 'IN',
          quantity: ing.currentStock,
          previousStock: 0,
          newStock: ing.currentStock,
          unitCost: ing.costPrice,
          note: 'Nhập kho ban đầu theo biên bản kiểm kê Hương Sen',
        },
      });
    }
  }

  // 2. Định lượng công thức món ăn (Recipes) cho các món tiêu biểu
  const recipeDefs: Array<{
    dishId: number;
    note: string;
    items: Array<{ ingCode: string; qty: number; unit: string }>;
  }> = [
    {
      dishId: 1, // Chả Giò Hương Sen Tôm Cua
      note: 'Định lượng 1 đĩa Chả Giò Hương Sen Tôm Cua (6 cuốn)',
      items: [
        { ingCode: 'ING-TOMSU', qty: 0.1, unit: 'kg' },
        { ingCode: 'ING-THITBACHI', qty: 0.1, unit: 'kg' },
        { ingCode: 'ING-BANHTRANG', qty: 1, unit: 'gói' },
        { ingCode: 'ING-NUOCMAM', qty: 0.05, unit: 'lít' },
        { ingCode: 'ING-DAUAN', qty: 0.08, unit: 'lít' },
      ],
    },
    {
      dishId: 2, // Gỏi Cuốn Tôm Thịt Tươi Sạch
      note: 'Định lượng 1 đĩa Gỏi Cuốn Tôm Thịt (4 cuốn)',
      items: [
        { ingCode: 'ING-TOMSU', qty: 0.08, unit: 'kg' },
        { ingCode: 'ING-THITBACHI', qty: 0.08, unit: 'kg' },
        { ingCode: 'ING-BUNTUOI', qty: 0.15, unit: 'kg' },
        { ingCode: 'ING-RAUSONG', qty: 0.1, unit: 'kg' },
        { ingCode: 'ING-BANHTRANG', qty: 1, unit: 'gói' },
      ],
    },
    {
      dishId: 3, // Gỏi Ngó Sen Tôm Thịt
      note: 'Định lượng 1 đĩa Gỏi Ngó Sen Tôm Thịt',
      items: [
        { ingCode: 'ING-NGOSEN', qty: 0.25, unit: 'kg' },
        { ingCode: 'ING-TOMSU', qty: 0.1, unit: 'kg' },
        { ingCode: 'ING-THITBACHI', qty: 0.08, unit: 'kg' },
        { ingCode: 'ING-NUOCMAM', qty: 0.04, unit: 'lít' },
      ],
    },
    {
      dishId: 10, // Gà Ta Hấp Lá Chanh
      note: 'Định lượng 1 đĩa Gà Ta Hấp Lá Chanh (nửa con)',
      items: [
        { ingCode: 'ING-GATA', qty: 0.8, unit: 'kg' },
        { ingCode: 'ING-NUOCMAM', qty: 0.05, unit: 'lít' },
        { ingCode: 'ING-RAUSONG', qty: 0.1, unit: 'kg' },
      ],
    },
    {
      dishId: 18, // Bò Tơ Nướng Tảng
      note: 'Định lượng 1 phần Bò Tơ Nướng Tảng',
      items: [
        { ingCode: 'ING-BOTO', qty: 0.35, unit: 'kg' },
        { ingCode: 'ING-DAUAN', qty: 0.04, unit: 'lít' },
        { ingCode: 'ING-RAUSONG', qty: 0.15, unit: 'kg' },
      ],
    },
    {
      dishId: 26, // Thịt Ba Chỉ Kho Quẹt Cháy Cạnh
      note: 'Định lượng 1 tộ Thịt Ba Chỉ Kho Quẹt kèm rau củ luộc',
      items: [
        { ingCode: 'ING-THITBACHI', qty: 0.25, unit: 'kg' },
        { ingCode: 'ING-NUOCMAM', qty: 0.06, unit: 'lít' },
        { ingCode: 'ING-RAUMUONG', qty: 0.3, unit: 'kg' },
      ],
    },
    {
      dishId: 35, // Cá Lóc Nướng Trui Rơm Vàng
      note: 'Định lượng 1 phần Cá Lóc Nướng Trui nguyên con',
      items: [
        { ingCode: 'ING-CALOC', qty: 1.0, unit: 'kg' },
        { ingCode: 'ING-BUNTUOI', qty: 0.3, unit: 'kg' },
        { ingCode: 'ING-RAUSONG', qty: 0.25, unit: 'kg' },
        { ingCode: 'ING-BANHTRANG', qty: 1, unit: 'gói' },
        { ingCode: 'ING-NUOCMAM', qty: 0.08, unit: 'lít' },
      ],
    },
    {
      dishId: 42, // Rau Muống Xào Tỏi Cô Đơn
      note: 'Định lượng 1 đĩa Rau Muống Xào Tỏi',
      items: [
        { ingCode: 'ING-RAUMUONG', qty: 0.4, unit: 'kg' },
        { ingCode: 'ING-DAUAN', qty: 0.05, unit: 'lít' },
      ],
    },
    {
      dishId: 57, // Cơm Chiên Hạt Sen Lá Sen
      note: 'Định lượng 1 thố Cơm Chiên Hạt Sen bọc lá sen',
      items: [
        { ingCode: 'ING-GAOST25', qty: 0.18, unit: 'kg' },
        { ingCode: 'ING-HATSEN', qty: 0.08, unit: 'kg' },
        { ingCode: 'ING-TOMSU', qty: 0.06, unit: 'kg' },
        { ingCode: 'ING-DAUAN', qty: 0.04, unit: 'lít' },
      ],
    },
    {
      dishId: 73, // Lẩu Riêu Cua Đồng Hương Sen
      note: 'Định lượng 1 nồi Lẩu Riêu Cua Đồng',
      items: [
        { ingCode: 'ING-CUADONG', qty: 0.3, unit: 'kg' },
        { ingCode: 'ING-SUONHEO', qty: 0.25, unit: 'kg' },
        { ingCode: 'ING-BUNTUOI', qty: 0.4, unit: 'kg' },
        { ingCode: 'ING-RAUMUONG', qty: 0.3, unit: 'kg' },
        { ingCode: 'ING-DAUHU', qty: 0.2, unit: 'kg' },
      ],
    },
    {
      dishId: 93, // Cà Phê Sữa Đá Sài Gòn
      note: 'Định lượng 1 ly Cà Phê Sữa Đá',
      items: [
        { ingCode: 'ING-CAPHE', qty: 0.025, unit: 'kg' },
        { ingCode: 'ING-SUADAC', qty: 0.04, unit: 'lon' },
      ],
    },
    {
      dishId: 94, // Trà Sen Tây Hồ Thượng Hạng
      note: 'Định lượng 1 ấm Trà Sen Tây Hồ',
      items: [
        { ingCode: 'ING-TRASEN', qty: 0.02, unit: 'kg' },
        { ingCode: 'ING-DUONGPHEN', qty: 0.015, unit: 'kg' },
      ],
    },
    {
      dishId: 105, // Chè Hạt Sen Long Nhãn Băng Đường
      note: 'Định lượng 1 bát Chè Hạt Sen',
      items: [
        { ingCode: 'ING-HATSEN', qty: 0.07, unit: 'kg' },
        { ingCode: 'ING-DUONGPHEN', qty: 0.04, unit: 'kg' },
      ],
    },
  ];

  let recipeCount = 0;
  for (const rDef of recipeDefs) {
    const dishExists = await prisma.dish.findUnique({ where: { id: rDef.dishId } });
    if (!dishExists) continue;

    const recipe = await prisma.recipe.upsert({
      where: { dishId: rDef.dishId },
      update: { note: rDef.note },
      create: {
        dishId: rDef.dishId,
        note: rDef.note,
      },
    });

    for (const item of rDef.items) {
      const ingId = ingMap.get(item.ingCode);
      if (!ingId) continue;

      await prisma.recipeItem.upsert({
        where: {
          recipeId_ingredientId: {
            recipeId: recipe.id,
            ingredientId: ingId,
          },
        },
        update: {
          quantity: item.qty,
          unit: item.unit,
        },
        create: {
          recipeId: recipe.id,
          ingredientId: ingId,
          quantity: item.qty,
          unit: item.unit,
        },
      });
    }
    recipeCount++;
  }

  // 3. Khởi tạo Nhật ký kiểm toán hệ thống ban đầu (Audit Log)
  const auditExists = await prisma.auditLog.count();
  if (auditExists === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          staffId: admin?.id || null,
          action: 'INITIALIZE_INVENTORY',
          entity: 'Ingredient',
          oldValue: null,
          newValue: JSON.stringify({ count: ingredientsData.length, note: 'Khởi tạo danh mục 24 nguyên liệu kho Hương Sen' }),
        },
        {
          staffId: admin?.id || null,
          action: 'SETUP_MENU_RECIPES',
          entity: 'Recipe',
          oldValue: null,
          newValue: JSON.stringify({ count: recipeCount, note: 'Thiết lập định lượng công thức món ăn đặc trưng' }),
        },
      ],
    });
  }

  console.log(`✅ Hoàn tất: 24 Nguyên liệu kho, ${recipeCount} Công thức định lượng và Nhật ký kiểm toán.`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed kho nguyên liệu:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
