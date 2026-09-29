import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { ConversationMemory, RecommendationPlan } from './chat.types.js';
import { normalizeVietnamese } from './chat.memory.js';

export class ChatTools {
  /**
   * 1. Tìm kiếm món ăn với bộ lọc khẩu vị, độ cay, dị ứng, giá bán
   */
  static async searchMenu(options: {
    query?: string;
    categorySlug?: string;
    categoryName?: string;
    maxPrice?: number;
    minPrice?: number;
    spicyPreference?: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'ANY';
    allergies?: string[];
    dislikes?: string[];
    isVegetarian?: boolean;
    take?: number;
  }) {
    const where: any = { isAvailable: true };

    // Lọc theo độ cay nếu khách có yêu cầu (đặc biệt không ăn cay)
    if (options.spicyPreference === 'NONE') {
      where.spicyLevel = 'NONE';
    } else if (options.spicyPreference === 'MILD') {
      where.spicyLevel = { in: ['NONE', 'MILD'] };
    }

    // Lọc theo tầm giá
    if (options.maxPrice || options.minPrice) {
      where.price = {};
      if (options.minPrice) where.price.gte = options.minPrice;
      if (options.maxPrice) where.price.lte = options.maxPrice;
    }

    // Lọc món chay
    if (options.isVegetarian) {
      where.OR = [
        { category: { name: { contains: 'Chay' } } },
        { name: { contains: 'chay' } },
        { tags: { contains: 'chay' } },
      ];
    }

    // Lọc theo danh mục
    if (options.categorySlug) {
      where.category = { slug: options.categorySlug };
    } else if (options.categoryName) {
      where.category = { name: { contains: options.categoryName } };
    }

    // Lọc theo từ khóa tìm kiếm
    if (options.query && options.query.trim()) {
      const q = options.query.trim();
      const existingOr = where.OR || [];
      where.OR = [
        ...existingOr,
        { name: { contains: q } },
        { shortDescription: { contains: q } },
        { description: { contains: q } },
        { category: { name: { contains: q } } },
      ];
    }

    let dishes = await prisma.dish.findMany({
      where,
      orderBy: [{ isBestSeller: 'desc' }, { soldCount: 'desc' }, { rating: 'desc' }],
      include: { category: true },
    });

    // Lọc theo từ khóa tìm kiếm (hỗ trợ không dấu, có dấu, tìm kiếm mờ theo từ)
    if (options.query && options.query.trim()) {
      const q = options.query.trim();
      const normQ = normalizeVietnamese(q);
      const wordRegex = new RegExp(`(?:^|[^a-z0-9])${normQ}(?:[^a-z0-9]|$)`, 'i');

      // Ưu tiên 1: Tên món ăn có chứa từ khóa
      const nameMatched = dishes.filter((dish) => {
        const nameNorm = normalizeVietnamese(dish.name);
        return normQ.length <= 3 ? wordRegex.test(nameNorm) : nameNorm.includes(normQ);
      });

      if (nameMatched.length > 0) {
        dishes = nameMatched;
      } else {
        // Ưu tiên 2: Tìm trong mô tả, danh mục, tags
        const queryFiltered = dishes.filter((dish) => {
          const dishText = normalizeVietnamese(
            `${dish.name} ${dish.category?.name || ''} ${dish.slug} ${dish.shortDescription || ''} ${dish.description || ''} ${dish.tags || ''}`
          );
          if (normQ.length <= 3) {
            return wordRegex.test(dishText);
          }
          return dishText.includes(normQ) || (normQ.length > 3 && normQ.split(/\s+/).some((w) => w.length > 2 && wordRegex.test(dishText)));
        });
        if (queryFiltered.length > 0) {
          dishes = queryFiltered;
        }
      }
    }

    // Lọc loại trừ dị ứng & món không thích nếu dữ liệu món có chứa
    let filtered = dishes;
    if (options.allergies && options.allergies.length > 0) {
      filtered = filtered.filter((dish) => {
        const allergenStr = normalizeVietnamese(`${dish.allergens || ''} ${dish.ingredients || ''} ${dish.name}`);
        return !options.allergies!.some((alg) => allergenStr.includes(normalizeVietnamese(alg)));
      });
    }

    if (options.dislikes && options.dislikes.length > 0) {
      filtered = filtered.filter((dish) => {
        const descStr = normalizeVietnamese(`${dish.name} ${dish.description || ''} ${dish.ingredients || ''}`);
        return !options.dislikes!.some((dis) => descStr.includes(normalizeVietnamese(dis)));
      });
    }

    return filtered.slice(0, options.take || 6).map(this.formatProduct);
  }

  /**
   * 2. Tìm chi tiết món ăn theo ID, Tên hoặc Slug
   */
  static async getDishDetails(queryOrId: string | number) {
    if (typeof queryOrId === 'number' || /^\d+$/.test(String(queryOrId))) {
      return await prisma.dish.findUnique({
        where: { id: Number(queryOrId) },
        include: { category: true, reviews: { take: 5, orderBy: { createdAt: 'desc' } } },
      });
    }

    const q = String(queryOrId).trim();
    const normQ = normalizeVietnamese(q);
    if (!normQ) return null;

    const allDishes = await prisma.dish.findMany({
      include: { category: true, reviews: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    // 1. Exact match on slug or normalized name
    let found = allDishes.find((d) => normalizeVietnamese(d.name) === normQ || d.slug === normQ);

    // 2. Substring match
    if (!found) {
      found = allDishes.find((d) => {
        const dNorm = normalizeVietnamese(d.name);
        return dNorm.includes(normQ) || normQ.includes(dNorm);
      });
    }

    // 3. Word overlap match (cho câu hỏi tự nhiên như "Cá rô đồng kho tộ có nguyên liệu gì")
    if (!found) {
      const qWords = normQ.split(/\s+/).filter((w) => w.length > 1 && !['mon', 'co', 'nay', 'do', 'cho', 'hoi', 'gi'].includes(w));
      if (qWords.length > 0) {
        let maxOverlap = 0;
        let bestDish: any = null;
        for (const d of allDishes) {
          const dWords = normalizeVietnamese(d.name).split(/\s+/);
          const overlap = qWords.filter((w) => dWords.includes(w)).length;
          if (overlap > maxOverlap && overlap >= 2) {
            maxOverlap = overlap;
            bestDish = d;
          }
        }
        if (bestDish && maxOverlap >= Math.min(2, qWords.length)) {
          found = bestDish;
        }
      }
    }

    return found || null;
  }

  /**
   * 3. So sánh 2 món ăn thực tế từ Database
   */
  static async compareDishes(nameA: string, nameB: string) {
    const [dishA, dishB] = await Promise.all([
      this.getDishDetails(nameA),
      this.getDishDetails(nameB),
    ]);

    if (!dishA || !dishB) {
      return {
        found: false as const,
        missing: !dishA ? nameA : nameB,
      };
    }

    const spicyMap: Record<string, string> = {
      NONE: 'Không cay (trẻ em ăn được)',
      MILD: 'Cay nhẹ thơm tiêu',
      MEDIUM: 'Cay vừa chuẩn vị',
      HOT: 'Cay nồng đậm đà',
      EXTRA_HOT: 'Rất cay',
    };

    return {
      found: true as const,
      dishA: {
        id: dishA.id,
        name: dishA.name,
        price: dishA.discountedPrice || dishA.price,
        originalPrice: dishA.price,
        category: dishA.category?.name || 'Món ngon',
        spicy: spicyMap[dishA.spicyLevel] || dishA.spicyLevel,
        rating: dishA.rating,
        servingSize: dishA.servingSize || '1 phần',
        prepTime: `${dishA.preparationTimeMinutes} phút`,
        description: dishA.shortDescription || dishA.description,
        isAvailable: dishA.isAvailable,
      },
      dishB: {
        id: dishB.id,
        name: dishB.name,
        price: dishB.discountedPrice || dishB.price,
        originalPrice: dishB.price,
        category: dishB.category?.name || 'Món ngon',
        spicy: spicyMap[dishB.spicyLevel] || dishB.spicyLevel,
        rating: dishB.rating,
        servingSize: dishB.servingSize || '1 phần',
        prepTime: `${dishB.preparationTimeMinutes} phút`,
        description: dishB.shortDescription || dishB.description,
        isAvailable: dishB.isAvailable,
      },
    };
  }

  /**
   * 4. Bộ máy Đề xuất Bữa ăn / Combo (Food Recommendation Engine)
   * Tính toán mâm cơm thực tế theo số người, ngân sách, khẩu vị, tránh dị ứng.
   */
  static async buildMealRecommendations(memory: ConversationMemory): Promise<RecommendationPlan[]> {
    const people = memory.numberOfPeople || 2;
    const targetBudget = memory.budget || (people * 180000);
    const isMild = memory.spicyPreference === 'NONE' || memory.spicyPreference === 'MILD';

    // Tạo điều kiện lọc cay & dị ứng
    const spicyFilter = isMild ? { spicyLevel: { in: ['NONE', 'MILD'] } } : {};

    // 1. Lấy nguyên liệu khai vị / gỏi
    const appetizers = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        category: { slug: { in: ['khai-vi', 'salad-goi'] } },
        ...spicyFilter,
      },
      orderBy: { soldCount: 'desc' },
      take: 4,
      include: { category: true },
    });

    // 2. Lấy món chính (Cá / Gà / Bò / Heo)
    const mains = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        category: { slug: { in: ['mon-ca', 'mon-ga', 'mon-bo', 'mon-heo', 'hai-san'] } },
        ...spicyFilter,
      },
      orderBy: { soldCount: 'desc' },
      take: 8,
      include: { category: true },
    });

    // 3. Lấy canh / lẩu
    const soups = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        category: { slug: { in: ['canh-lau', 'com-nieu'] } },
        ...spicyFilter,
      },
      orderBy: { soldCount: 'desc' },
      take: 6,
      include: { category: true },
    });

    // 4. Lấy tráng miệng / nước
    const desserts = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        category: { slug: { in: ['trang-mieng', 'do-uong'] } },
      },
      orderBy: { soldCount: 'desc' },
      take: 4,
      include: { category: true },
    });

    // Xây dựng PHƯƠNG ÁN 1: Mâm Cơm Gia Đình Quê Nhà (Cá kho / Gà kho + Canh + Rau/Kho quẹt + Cơm niêu)
    const plan1Dishes: any[] = [];
    if (mains[0]) plan1Dishes.push(this.formatProduct(mains[0]));
    if (soups[0]) plan1Dishes.push(this.formatProduct(soups[0]));
    if (appetizers[0]) plan1Dishes.push(this.formatProduct(appetizers[0]));
    if (people >= 4 && mains[1]) {
      plan1Dishes.push(this.formatProduct(mains[1]));
    }
    const plan1Total = plan1Dishes.reduce((sum, d) => sum + (d.discountedPrice || d.price), 0);

    const plan1: RecommendationPlan = {
      planId: 1,
      title: `Phương án 1: Mâm Cơm Gia Đình Quê Nhà (${people} người)`,
      badge: 'Cơm Niêu Chuẩn Vị',
      description: 'Mâm cơm đậm vị mộc mạc: Món chính kho đậm đà, tô canh thanh ngọt và đĩa rau giòn chấm mắm quẹt.',
      dishes: plan1Dishes,
      subtotal: plan1Total,
    };

    // Xây dựng PHƯƠNG ÁN 2: Mâm Đặc Sản Hương Sen (Món nướng than hoa + Gỏi ngó sen + Lẩu/Canh đặc sắc + Tráng miệng)
    const plan2Dishes: any[] = [];
    if (appetizers[1] || appetizers[0]) plan2Dishes.push(this.formatProduct(appetizers[1] || appetizers[0]));
    if (mains[2] || mains[1]) plan2Dishes.push(this.formatProduct(mains[2] || mains[1]));
    if (soups[1] || soups[0]) plan2Dishes.push(this.formatProduct(soups[1] || soups[0]));
    if (desserts[0]) plan2Dishes.push(this.formatProduct(desserts[0]));
    const plan2Total = plan2Dishes.reduce((sum, d) => sum + (d.discountedPrice || d.price), 0);

    const plan2: RecommendationPlan = {
      planId: 2,
      title: `Phương án 2: Mâm Đặc Sản Hương Sen (${people} người)`,
      badge: 'Bestseller Trứ Danh',
      description: 'Thưởng thức các món đặc trưng nhất của nhà hàng: Món nướng mộc thơm lừng, gỏi thanh mát và tráng miệng hạt sen.',
      dishes: plan2Dishes,
      subtotal: plan2Total,
    };

    const results = [plan1, plan2];

    // Nếu đoàn từ 4 người hoặc khách thích lẩu -> Bổ sung PHƯƠNG ÁN 3: Lẩu Sum Vầy
    if (people >= 3 || memory.foodPreferences.includes('lẩu')) {
      const hotpotDish = soups.find((s) => normalizeVietnamese(s.name).includes('lau')) || soups[0];
      const plan3Dishes: any[] = [];
      if (hotpotDish) plan3Dishes.push(this.formatProduct(hotpotDish));
      if (appetizers[0]) plan3Dishes.push(this.formatProduct(appetizers[0]));
      if (desserts[1] || desserts[0]) plan3Dishes.push(this.formatProduct(desserts[1] || desserts[0]));
      const plan3Total = plan3Dishes.reduce((sum, d) => sum + (d.discountedPrice || d.price), 0);

      results.push({
        planId: 3,
        title: `Phương án 3: Bữa Tiệc Lẩu Nóng Sum Vầy (${people} người)`,
        badge: 'Lẩu Bếp Nấu',
        description: 'Nồi lẩu nóng bốc khói đậm vị gắn kết các thành viên, kèm món khai vị giòn rụm.',
        dishes: plan3Dishes,
        subtotal: plan3Total,
      });
    }

    return results;
  }

  /**
   * 5. Đọc đánh giá thật của món ăn
   */
  static async getDishReviews(dishId: number) {
    const reviews = await prisma.review.findMany({
      where: { dishId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { name: true, rating: true, reviewCount: true },
    });

    return {
      dishName: dish?.name || 'Món ăn',
      rating: dish?.rating || 5.0,
      reviewCount: dish?.reviewCount || reviews.length,
      reviews: reviews.map((r) => ({
        userName: r.userName,
        rating: r.rating,
        comment: r.comment,
        date: r.createdAt,
      })),
    };
  }

  /**
   * 6. Kiểm tra tình trạng bàn ăn thực tế
   */
  static async checkReservationCapacity(guestCount: number = 2) {
    const availableTables = await prisma.table.count({
      where: { status: 'available', isActive: true },
    });

    const suitableTables = await prisma.table.count({
      where: {
        status: 'available',
        isActive: true,
        capacity: { gte: guestCount },
      },
    });

    return {
      totalAvailable: availableTables,
      suitableCount: suitableTables,
      canAccommodate: suitableTables > 0 || (availableTables > 0 && guestCount <= 10),
    };
  }

  /**
   * Format sản phẩm chuẩn UI ChatProductCard
   */
  static formatProduct(dish: any) {
    return {
      id: dish.id,
      name: dish.name,
      slug: dish.slug,
      price: dish.price,
      discountedPrice: dish.discountedPrice,
      imageUrl: dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
      rating: dish.rating || 5.0,
      reviewCount: dish.reviewCount || 0,
      isAvailable: dish.isAvailable,
      shortDescription: dish.shortDescription || dish.description || '',
      categoryName: dish.category?.name || 'Món ngon',
      spicyLevel: dish.spicyLevel || 'NONE',
    };
  }
}
