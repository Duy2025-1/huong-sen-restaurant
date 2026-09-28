import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// 1. GET /api/menu - Lấy toàn bộ thực đơn kèm danh mục và tùy chọn (Public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        dishes: {
          include: {
            station: true,
            modifierGroups: {
              include: {
                modifierGroup: {
                  include: {
                    items: {
                      where: { isAvailable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.json(categories);
  } catch (error) {
    console.error('Error fetching menu:', error);
    return res.status(500).json({ message: 'Lỗi tải thực đơn.' });
  }
});

// 1.1 GET /api/menu/dishes - Danh sách món ăn có lọc đa tiêu chí, tìm kiếm & sắp xếp
router.get('/dishes', async (req: Request, res: Response) => {
  try {
    const {
      search,
      categoryId,
      categorySlug,
      spicyLevel,
      minPrice,
      maxPrice,
      isAvailable,
      isBestSeller,
      isPopular,
      isNew,
      sort = 'popular',
      page,
      limit,
    } = req.query;

    const where: any = {};

    // Filter by availability
    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable === 'true';
    }

    // Category filter
    if (categoryId) {
      const cId = parseInt(categoryId as string);
      if (!isNaN(cId)) where.categoryId = cId;
    } else if (categorySlug) {
      where.category = { slug: categorySlug as string };
    }

    // Spicy level filter
    if (spicyLevel && typeof spicyLevel === 'string') {
      where.spicyLevel = spicyLevel;
    }

    // Price range
    const minP = minPrice ? parseFloat(minPrice as string) : undefined;
    const maxP = maxPrice ? parseFloat(maxPrice as string) : undefined;
    if (minP !== undefined || maxP !== undefined) {
      where.price = {};
      if (minP !== undefined && !isNaN(minP)) where.price.gte = minP;
      if (maxP !== undefined && !isNaN(maxP)) where.price.lte = maxP;
    }

    // Boolean flags
    if (isBestSeller === 'true') where.isBestSeller = true;
    if (isPopular === 'true') where.isPopular = true;
    if (isNew === 'true') where.isNew = true;

    // Search query
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term } },
        { shortDescription: { contains: term } },
        { description: { contains: term } },
        { ingredients: { contains: term } },
        { tags: { contains: term } },
      ];
    }

    // Sorting
    let orderBy: any = [{ isPopular: 'desc' }, { soldCount: 'desc' }];
    if (sort === 'rating') {
      orderBy = { rating: 'desc' };
    } else if (sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (sort === 'price_desc') {
      orderBy = { price: 'desc' };
    } else if (sort === 'newest') {
      orderBy = [{ isNew: 'desc' }, { id: 'desc' }];
    } else if (sort === 'bestseller') {
      orderBy = [{ isBestSeller: 'desc' }, { soldCount: 'desc' }];
    }

    // Pagination
    const pageNum = page ? Math.max(1, parseInt(page as string) || 1) : 1;
    const take = limit ? Math.min(200, Math.max(1, parseInt(limit as string) || 50)) : 100;
    const skip = (pageNum - 1) * take;

    const [dishes, total] = await Promise.all([
      prisma.dish.findMany({
        where,
        orderBy,
        skip: page ? skip : undefined,
        take: page ? take : undefined,
        include: {
          category: true,
          station: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  items: { where: { isAvailable: true } },
                },
              },
            },
          },
        },
      }),
      prisma.dish.count({ where }),
    ]);

    return res.json({
      dishes,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.error('Error querying dishes:', error);
    return res.status(500).json({ message: 'Lỗi tìm kiếm món ăn.' });
  }
});

// 1.2 GET /api/menu/dish/:slugOrId - Xem chi tiết món ăn kèm đánh giá và món gợi ý liên quan
router.get('/dish/:slugOrId', async (req: Request, res: Response) => {
  try {
    const param = req.params.slugOrId as string;
    const parsedId = parseInt(param);
    const whereClause: any = !isNaN(parsedId) && String(parsedId) === param ? { id: parsedId } : { slug: param };

    const dish = await prisma.dish.findFirst({
      where: whereClause,
      include: {
        category: true,
        station: true,
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                items: { where: { isAvailable: true } },
              },
            },
          },
        },
      },
    });

    if (!dish) {
      return res.status(404).json({ message: 'Không tìm thấy món ăn.' });
    }

    // Related dishes in same category
    const relatedDishes = await prisma.dish.findMany({
      where: {
        categoryId: dish.categoryId,
        id: { not: dish.id },
        isAvailable: true,
      },
      take: 4,
      orderBy: { rating: 'desc' },
      include: {
        category: true,
      },
    });

    return res.json({
      ...dish,
      relatedDishes,
    });
  } catch (error) {
    console.error('Error fetching dish details:', error);
    return res.status(500).json({ message: 'Lỗi tải chi tiết món ăn.' });
  }
});

// 1.3 POST /api/menu/dish/:id/reviews - Gửi đánh giá cho món ăn
router.post('/dish/:id/reviews', async (req: Request, res: Response) => {
  try {
    const dishId = parseInt(req.params.id as string);
    if (isNaN(dishId) || dishId <= 0) {
      return res.status(400).json({ message: 'Mã món ăn không hợp lệ.' });
    }

    const { userName, avatar, rating, comment } = req.body;
    if (!userName || typeof userName !== 'string' || !userName.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên người đánh giá.' });
    }
    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ message: 'Nội dung nhận xét không được để trống.' });
    }

    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Số sao đánh giá phải từ 1 đến 5 sao.' });
    }

    const dish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) {
      return res.status(404).json({ message: 'Món ăn không tồn tại.' });
    }

    // Verify purchase against real completed orders
    let isVerified = false;
    let matchingOrderId: number | null = null;

    const matchingOrder = await prisma.order.findFirst({
      where: {
        status: 'completed',
        orderItems: {
          some: { dishId },
        },
        OR: [
          { customerName: { equals: userName.trim() } },
          { customer: { fullName: { equals: userName.trim() } } },
        ],
      },
      select: { id: true },
    });

    if (matchingOrder) {
      isVerified = true;
      matchingOrderId = matchingOrder.id;
    }

    const review = await prisma.review.create({
      data: {
        dishId,
        orderId: matchingOrderId,
        userName: userName.trim().slice(0, 100),
        avatar: avatar && typeof avatar === 'string' ? avatar.trim() : null,
        rating: Math.round(numRating * 10) / 10,
        comment: comment.trim().slice(0, 500),
        verifiedPurchase: isVerified,
      },
    });

    // Recalculate average rating & review count for the dish
    const stats = await prisma.review.aggregate({
      where: { dishId },
      _avg: { rating: true },
      _count: { id: true },
    });

    const newAvgRating = Math.round((stats._avg.rating || 5.0) * 10) / 10;
    const newCount = stats._count.id || 0;

    await prisma.dish.update({
      where: { id: dishId },
      data: {
        rating: newAvgRating,
        reviewCount: newCount,
      },
    });

    return res.status(201).json({
      message: 'Gửi đánh giá thành công! Cảm ơn bạn đã phản hồi.',
      review,
      newRating: newAvgRating,
      newReviewCount: newCount,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({ message: 'Lỗi khi gửi đánh giá.' });
  }
});

// 2. GET /api/menu/stations - Lấy danh sách trạm bếp (KDS)
router.get('/stations', async (req: Request, res: Response) => {
  try {
    const stations = await prisma.kitchenStation.findMany({
      where: { isActive: true },
    });
    return res.json(stations);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải trạm bếp.' });
  }
});

// 3. PATCH /api/menu/dishes/:id/toggle-availability - Báo Hết Món / Có Món (Tính năng 86 Item)
// SEC FIX: Enforce staff authorization (admin, manager, chef, cashier) so regular customers cannot disable dishes
const toggleAvailabilityHandler = async (req: Request, res: Response) => {
  try {
    const dishId = parseInt(req.params.id as string);
    if (isNaN(dishId) || dishId <= 0) {
      return res.status(400).json({ message: 'Mã món ăn không hợp lệ.' });
    }

    const dish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) return res.status(404).json({ message: 'Không tìm thấy món ăn.' });

    const updated = await prisma.dish.update({
      where: { id: dishId },
      data: { isAvailable: !dish.isAvailable },
    });

    broadcastEvent(SocketEvents.DISH_AVAILABILITY_CHANGED, {
      dishId: updated.id,
      name: updated.name,
      isAvailable: updated.isAvailable,
    });

    return res.json({
      message: `Đã đổi trạng thái món "${updated.name}" sang ${updated.isAvailable ? 'Còn món' : 'Hết món (86)'}.`,
      dish: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái món.' });
  }
};

router.patch('/:id/toggle-availability', authenticate, authorize(['admin', 'manager', 'chef', 'cashier']), toggleAvailabilityHandler);
router.patch('/dishes/:id/toggle-availability', authenticate, authorize(['admin', 'manager', 'chef', 'cashier']), toggleAvailabilityHandler);


// 4. POST /api/menu/dishes - Thêm món mới (Admin / Quản lý)
router.post('/dishes', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { categoryId, stationId, name, price, discountedPrice, description, imageUrl, preparationTimeMinutes } = req.body;

    // Strict validation
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
      return res.status(400).json({ message: 'Tên món ăn không được để trống và tối đa 150 ký tự.' });
    }

    const parsedCategoryId = parseInt(categoryId);
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      return res.status(400).json({ message: 'Danh mục không hợp lệ.' });
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0 || numPrice > 100000000) {
      return res.status(400).json({ message: 'Giá món ăn phải từ 0 đến 100.000.000 VNĐ.' });
    }

    let numDiscountedPrice: number | null = null;
    if (discountedPrice !== undefined && discountedPrice !== null && discountedPrice !== '') {
      numDiscountedPrice = parseFloat(discountedPrice);
      if (isNaN(numDiscountedPrice) || numDiscountedPrice < 0 || numDiscountedPrice > numPrice) {
        return res.status(400).json({ message: 'Giá khuyến mãi không hợp lệ (phải từ 0 đến giá gốc).' });
      }
    }

    let prepTime = 10;
    if (preparationTimeMinutes !== undefined) {
      prepTime = parseInt(preparationTimeMinutes);
      if (isNaN(prepTime) || prepTime < 1 || prepTime > 300) {
        prepTime = 10;
      }
    }

    const slug =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + `-${Date.now()}`;

    const newDish = await prisma.dish.create({
      data: {
        categoryId: parsedCategoryId,
        stationId: stationId ? parseInt(stationId) : null,
        name: name.trim(),
        slug,
        description: description && typeof description === 'string' ? description.trim() : null,
        price: numPrice,
        discountedPrice: numDiscountedPrice,
        imageUrl: imageUrl && typeof imageUrl === 'string' ? imageUrl.trim() : null,
        preparationTimeMinutes: prepTime,
      },
    });

    return res.status(201).json(newDish);
  } catch (error) {
    console.error('Error creating dish:', error);
    return res.status(500).json({ message: 'Lỗi tạo món ăn.' });
  }
});

// 5. PUT /api/menu/dishes/:id - Sửa thông tin món (Admin / Quản lý)
router.put('/dishes/:id', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const dishId = parseInt(req.params.id as string);
    if (isNaN(dishId) || dishId <= 0) {
      return res.status(400).json({ message: 'Mã món ăn không hợp lệ.' });
    }

    const { categoryId, stationId, name, price, discountedPrice, description, imageUrl, preparationTimeMinutes } = req.body;

    const existingDish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!existingDish) {
      return res.status(404).json({ message: 'Không tìm thấy món ăn cần cập nhật.' });
    }

    let updatedPrice = existingDish.price;
    if (price !== undefined) {
      const numPrice = parseFloat(price);
      if (isNaN(numPrice) || numPrice < 0 || numPrice > 100000000) {
        return res.status(400).json({ message: 'Giá món ăn không hợp lệ.' });
      }
      updatedPrice = numPrice;
    }

    let updatedDiscount: number | null = existingDish.discountedPrice;
    if (discountedPrice !== undefined) {
      if (discountedPrice === null || discountedPrice === '') {
        updatedDiscount = null;
      } else {
        const numDiscount = parseFloat(discountedPrice);
        if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > updatedPrice) {
          return res.status(400).json({ message: 'Giá khuyến mãi không hợp lệ.' });
        }
        updatedDiscount = numDiscount;
      }
    }

    const updatedDish = await prisma.dish.update({
      where: { id: dishId },
      data: {
        categoryId: categoryId ? parseInt(categoryId) : existingDish.categoryId,
        stationId: stationId !== undefined ? (stationId ? parseInt(stationId) : null) : existingDish.stationId,
        name: name && typeof name === 'string' ? name.trim() : existingDish.name,
        description: description !== undefined ? (typeof description === 'string' ? description.trim() : null) : existingDish.description,
        price: updatedPrice,
        discountedPrice: updatedDiscount,
        imageUrl: imageUrl !== undefined ? (typeof imageUrl === 'string' ? imageUrl.trim() : null) : existingDish.imageUrl,
        preparationTimeMinutes: preparationTimeMinutes ? parseInt(preparationTimeMinutes) : existingDish.preparationTimeMinutes,
      },
    });

    return res.json({ message: 'Cập nhật món ăn thành công!', dish: updatedDish });
  } catch (error) {
    console.error('Error updating dish:', error);
    return res.status(500).json({ message: 'Lỗi khi cập nhật món ăn.' });
  }
});

// 6. DELETE /api/menu/dishes/:id - Xóa món ăn (Admin / Quản lý)
router.delete('/dishes/:id', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const dishId = parseInt(req.params.id as string);
    if (isNaN(dishId) || dishId <= 0) {
      return res.status(400).json({ message: 'Mã món ăn không hợp lệ.' });
    }

    // Check if dish has order items
    const orderItemsCount = await prisma.orderItem.count({ where: { dishId } });
    if (orderItemsCount > 0) {
      // If dish was already ordered, soft delete it by setting isAvailable = false
      await prisma.dish.update({
        where: { id: dishId },
        data: { isAvailable: false },
      });
      return res.json({ message: 'Món ăn đã có trong lịch sử đơn hàng nên được đánh dấu ngừng bán (Soft Delete) để bảo toàn dữ liệu kế toán.' });
    }

    await prisma.dishModifierGroup.deleteMany({ where: { dishId } });
    await prisma.dish.delete({ where: { id: dishId } });

    return res.json({ message: 'Xóa món ăn thành công!' });
  } catch (error) {
    console.error('Error deleting dish:', error);
    return res.status(500).json({ message: 'Lỗi khi xóa món ăn.' });
  }
});

// 7. POST /api/menu/categories - Tạo danh mục món ăn mới
router.post('/categories', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { name, imageUrl, displayOrder } = req.body;
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ message: 'Vui lòng nhập tên danh mục hợp lệ (tối đa 100 ký tự).' });
    }

    const slug =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + `-${Date.now()}`;

    const newCat = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        imageUrl: imageUrl && typeof imageUrl === 'string' ? imageUrl.trim() : null,
        displayOrder: displayOrder ? parseInt(displayOrder) : 0,
      },
    });

    return res.status(201).json(newCat);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tạo danh mục.' });
  }
});

export default router;
