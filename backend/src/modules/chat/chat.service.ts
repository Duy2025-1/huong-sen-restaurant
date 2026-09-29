import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';

export interface ChatMessageResponse {
  id: string;
  role: 'assistant';
  text: string;
  products?: any[];
  order?: any;
  quickReplies?: string[];
  action?: {
    type: 'view_menu' | 'open_reserve' | 'view_order' | 'add_to_cart';
    payload?: any;
  };
}

export interface ChatContext {
  customerPhone?: string;
  orderCode?: string;
  tableToken?: string;
  user?: {
    id?: number;
    fullName?: string;
    phone?: string;
  };
}

// Chuẩn hóa chuỗi tiếng Việt không dấu để so khớp linh hoạt
function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

export class ChatService {
  /**
   * Xử lý tin nhắn khách hàng dựa trên dữ liệu thật của nhà hàng Hương Sen
   */
  static async processMessage(message: string, context: ChatContext = {}): Promise<ChatMessageResponse> {
    const rawMsg = (message || '').trim();
    const norm = normalizeVietnamese(rawMsg);
    const msgId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    if (!rawMsg) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Chào bạn! Hương Sen có thể giúp gì cho bạn hôm nay ạ?',
        quickReplies: ['Xem thực đơn', 'Món nào được gọi nhiều?', 'Tôi muốn đặt bàn', 'Kiểm tra đơn hàng'],
      };
    }

    // 1. AN TOÀN & BẢO MẬT: Chống Prompt Injection / Đòi thông tin nhạy cảm
    if (
      norm.includes('bo qua tat ca') ||
      norm.includes('ignore all') ||
      norm.includes('mat khau') ||
      norm.includes('password') ||
      norm.includes('don hang cua nguoi khac') ||
      norm.includes('database') ||
      norm.includes('hack') ||
      norm.includes('token')
    ) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, em là nhân viên tư vấn của Nhà hàng Hương Sen, chỉ hỗ trợ quý khách xem thực đơn, tư vấn món ăn, đặt bàn và tra cứu đơn hàng của chính quý khách. Em không có quyền truy cập hay cung cấp các dữ liệu nội bộ khác ạ.',
        quickReplies: ['Xem thực đơn', 'Món nào bán chạy?', 'Đặt bàn ngay'],
      };
    }

    // 2. GỌI TÍNH TIỀN / THANH TOÁN TẠI BÀN
    if (
      norm.includes('thanh toan') ||
      norm.includes('tinh tien') ||
      norm.includes('goi tinh tien') ||
      norm.includes('tinh tien giup') ||
      norm.includes('lay hoa don')
    ) {
      return await this.handlePaymentRequest(context, msgId);
    }

    // 3. TRA CỨU ĐƠN HÀNG (THEO MÃ ĐƠN HOẶC SĐT)
    const phoneMatch = rawMsg.match(/0[3|5|7|8|9][0-9]{8}/);
    const orderCodeMatch = rawMsg.match(/HS-\d{8}-\d{3,4}|ORD-\S+/i);

    if (
      orderCodeMatch ||
      phoneMatch ||
      norm.includes('kiem tra don') ||
      norm.includes('tra cuu don') ||
      norm.includes('don cua toi') ||
      norm.includes('bep lam chua') ||
      norm.includes('don dang o dau')
    ) {
      const queryParam = orderCodeMatch ? orderCodeMatch[0] : phoneMatch ? phoneMatch[0] : context.customerPhone || (context.user?.phone ?? null);
      if (queryParam) {
        return await this.lookupOrder(queryParam, msgId);
      } else {
        return {
          id: msgId,
          role: 'assistant',
          text: 'Dạ, để kiểm tra tiến trình đơn hàng, bạn vui lòng gửi cho mình **Mã đơn hàng** (VD: `HS-20260928-0001`) hoặc **Số điện thoại** dùng khi đặt món nhé!',
          quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Liên hệ hotline'],
        };
      }
    }

    // 4. ĐẶT BÀN / KIỂM TRA BÀN TRỐNG
    if (
      norm.includes('dat ban') ||
      norm.includes('giu ban') ||
      norm.includes('con ban khong') ||
      norm.includes('dat cho') ||
      norm.includes('book ban')
    ) {
      return await this.handleReservationInquiry(rawMsg, norm, msgId);
    }

    // 5. THÔNG TIN NHÀ HÀNG (GIỜ MỞ CỬA, ĐỊA CHỈ, HOTLINE, CHÍNH SÁCH)
    if (
      norm.includes('mo cua') ||
      norm.includes('dong cua') ||
      norm.includes('may gio') ||
      norm.includes('dia chi') ||
      norm.includes('o dau') ||
      norm.includes('vi tri') ||
      norm.includes('hotline') ||
      norm.includes('so dien thoai') ||
      norm.includes('lien he') ||
      norm.includes('phuong thuc thanh toan')
    ) {
      return await this.getRestaurantInfo(norm, msgId);
    }

    // 6. KIỂM TRA TÌNH TRẠNG MÓN CÒN HAY HẾT (AVAILABILITY)
    if (norm.includes('con khong') || norm.includes('het chua') || norm.includes('co con')) {
      const availRes = await this.checkDishAvailability(rawMsg, norm, msgId);
      if (availRes) return availRes;
    }

    // 7. MÓN BÁN CHẠY / ĐƯỢC GỌI NHIỀU / ĐẶC TRƯNG
    if (
      norm.includes('duoc goi nhieu') ||
      norm.includes('ban chay') ||
      norm.includes('best seller') ||
      norm.includes('dac trung') ||
      norm.includes('ngon nhat') ||
      norm.includes('noi bat') ||
      norm.includes('mon hot')
    ) {
      return await this.getBestSellerDishes(msgId);
    }

    // 8. TƯ VẤN / GỢI Ý COMBO CHO 2 NGƯỜI / 4 NGƯỜI / GIA ĐÌNH
    if (
      norm.includes('2 nguoi') ||
      norm.includes('hai nguoi') ||
      norm.includes('4 nguoi') ||
      norm.includes('bon nguoi') ||
      norm.includes('gia dinh') ||
      norm.includes('goi y') ||
      norm.includes('tu van') ||
      norm.includes('nen goi gi')
    ) {
      return await this.getRecommendation(rawMsg, norm, msgId);
    }

    // 9. LỌC MÓN THEO GIÁ (DƯỚI 100K, 150K, 200K)
    const priceMatch = rawMsg.match(/duoi\s+(\d+)\s*(k|nghin|ngan|000)/i) || norm.match(/duoi\s+(\d+)\s*(k|nghin|ngan|000)/);
    if (priceMatch || norm.includes('gia re') || norm.includes('khoang gia')) {
      let maxPrice = 150000;
      if (priceMatch) {
        const val = parseInt(priceMatch[1]);
        if (priceMatch[2].toLowerCase() === 'k' || priceMatch[2].toLowerCase() === 'nghin' || priceMatch[2].toLowerCase() === 'ngan') {
          maxPrice = val * 1000;
        } else {
          maxPrice = val;
        }
      }
      return await this.searchDishesByPrice(maxPrice, msgId);
    }

    // 10. MÓN CHAY / ĂN CHAY
    if (norm.includes('chay') || norm.includes('thanh dam')) {
      return await this.searchVegetarianDishes(msgId);
    }

    // 11. MÓN KHÔNG CAY / ÍT CAY / DÀNH CHO TRẺ EM
    if (
      norm.includes('khong cay') ||
      norm.includes('it cay') ||
      norm.includes('tre em') ||
      norm.includes('cho be') ||
      norm.includes('cay it')
    ) {
      return await this.searchMildDishes(msgId);
    }

    // 12. TÌM KIẾM MÓN ĂN THEO NGUYÊN LIỆU HOẶC TÊN CỤ THỂ
    const specificSearch = await this.searchMenuByKeyword(rawMsg, norm, msgId);
    if (specificSearch) {
      return specificSearch;
    }

    // 13. FALLBACK THÂN THIỆN & KHÔNG BỊA DỮ LIỆU
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, Hương Sen chưa tìm thấy thông tin phù hợp với yêu cầu này trên hệ thống. Bạn có thể xem toàn bộ thực đơn 118 món thuần Việt hoặc liên hệ trực tiếp hotline 0901.234.567 để nhân viên tư vấn chi tiết hơn nhé!',
      quickReplies: ['Xem thực đơn', 'Món nào bán chạy?', 'Đặt bàn ngay', 'Hotline nhà hàng'],
      action: {
        type: 'view_menu',
        payload: '/menu',
      },
    };
  }

  /**
   * 1. Tra cứu thông tin nhà hàng thật từ CSDL
   */
  private static async getRestaurantInfo(norm: string, msgId: string): Promise<ChatMessageResponse> {
    const branch = await prisma.branch.findFirst();
    const branchName = branch?.name || 'Nhà Hàng Ẩm Thực Hương Sen';
    const address = branch?.address || 'Số 18 Đường Hoa Sen, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh';
    const phone = branch?.phone || '0901.234.567';

    if (norm.includes('may gio') || norm.includes('mo cua') || norm.includes('dong cua') || norm.includes('thoi gian')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Nhà hàng **${branchName}** mở cửa phục vụ tất cả các ngày trong tuần:\n\n• **Giờ mở cửa:** 10:00 - 22:30 hàng ngày\n• **Bếp nhận order cuối:** 21:45\n\nBạn muốn đặt bàn vào khung giờ nào hôm nay để nhà hàng chuẩn bị chu đáo nhất ạ?`,
        quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Địa chỉ ở đâu?'],
        action: { type: 'open_reserve', payload: '/reserve' },
      };
    }

    if (norm.includes('dia chi') || norm.includes('o dau') || norm.includes('vi tri')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Địa chỉ của **${branchName}** tọa lạc tại:\n📍 **${address}**\n\n(Ngay trung tâm Quận 1, có bãi đậu xe ô tô và xe máy rộng rãi, an ninh).`,
        quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Giờ mở cửa?'],
      };
    }

    if (norm.includes('hotline') || norm.includes('so dien thoai') || norm.includes('lien he')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Bạn có thể liên hệ trực tiếp với Hương Sen qua:\n\n📞 **Hotline đặt bàn & hỗ trợ:** ${phone}\n✉️ **Email:** lienhe@huongsen.vn\n📍 **Địa chỉ:** ${address}`,
        quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn'],
      };
    }

    if (norm.includes('thanh toan')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Hương Sen hỗ trợ đa dạng phương thức thanh toán thuận tiện:\n\n• **Tiền mặt** tại quầy hoặc tại bàn\n• **Quẹt thẻ POS** (Visa, MasterCard, Napas)\n• **Chuyển khoản VietQR** tự động\n• **Ví điện tử MoMo**`,
        quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn'],
      };
    }

    return {
      id: msgId,
      role: 'assistant',
      text: `**${branchName}**\n📍 ${address}\n📞 Hotline: ${phone}\n⏰ Giờ phục vụ: 10:00 - 22:30 (Thứ 2 - Chủ Nhật)\n\nHương Sen có thể hỗ trợ gì thêm cho bạn ạ?`,
      quickReplies: ['Xem thực đơn', 'Món nào bán chạy?', 'Đặt bàn ngay'],
    };
  }

  /**
   * 2. Lấy danh sách món bán chạy từ Database thật
   */
  private static async getBestSellerDishes(msgId: string): Promise<ChatMessageResponse> {
    const dishes = await prisma.dish.findMany({
      where: { isAvailable: true },
      orderBy: [{ isBestSeller: 'desc' }, { soldCount: 'desc' }, { rating: 'desc' }],
      take: 4,
      include: { category: true },
    });

    if (dishes.length === 0) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Hiện tại hệ thống đang cập nhật danh sách món bán chạy. Bạn có thể xem thực đơn đầy đủ tại trang Thực đơn nhé!',
        action: { type: 'view_menu', payload: '/menu' },
      };
    }

    const dishListText = dishes
      .map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ (★ ${d.rating.toFixed(1)})`)
      .join('\n');

    return {
      id: msgId,
      role: 'assistant',
      text: `Hiện tại một số món thuần Việt được thực khách gọi nhiều nhất tại Hương Sen:\n\n${dishListText}\n\nBạn có thể bấm trực tiếp vào thẻ món bên dưới để xem chi tiết hoặc thêm vào giỏ nhé!`,
      products: dishes.map(this.formatProduct),
      quickReplies: ['Có món chay không?', 'Có món ít cay không?', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 3. Tìm món theo tầm giá
   */
  private static async searchDishesByPrice(maxPrice: number, msgId: string): Promise<ChatMessageResponse> {
    const dishes = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        price: { lte: maxPrice },
      },
      take: 4,
      orderBy: [{ rating: 'desc' }, { soldCount: 'desc' }],
      include: { category: true },
    });

    if (dishes.length === 0) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Hệ thống chưa tìm thấy món ăn nào dưới ${maxPrice.toLocaleString('vi-VN')}đ đang mở bán. Bạn có thể xem toàn bộ thực đơn với nhiều phân khúc giá khác nhau nhé!`,
        action: { type: 'view_menu', payload: '/menu' },
      };
    }

    const textList = dishes
      .map((d) => `• **${d.name}**: ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ`)
      .join('\n');

    return {
      id: msgId,
      role: 'assistant',
      text: `Dưới đây là một số món ngon có mức giá dưới **${maxPrice.toLocaleString('vi-VN')}đ** được yêu thích tại quán:\n\n${textList}`,
      products: dishes.map(this.formatProduct),
      quickReplies: ['Món nào bán chạy?', 'Có món chay không?', 'Xem thực đơn đầy đủ'],
    };
  }

  /**
   * 4. Tìm món chay / thanh đạm
   */
  private static async searchVegetarianDishes(msgId: string): Promise<ChatMessageResponse> {
    const dishes = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        OR: [
          { category: { name: { contains: 'Chay' } } },
          { name: { contains: 'chay' } },
          { tags: { contains: 'chay' } },
          { description: { contains: 'chay' } },
        ],
      },
      take: 4,
      orderBy: { rating: 'desc' },
      include: { category: true },
    });

    if (dishes.length === 0) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Hương Sen có phục vụ các món chay và rau củ thanh đạm theo mùa. Bạn có thể xem mục Món Chay trên thực đơn hoặc liên hệ bếp để được chuẩn bị riêng nhé!',
        action: { type: 'view_menu', payload: '/menu' },
      };
    }

    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ có ạ! Hương Sen có các món chay và món thanh đạm từ rau củ tươi, đậu hũ và hạt sen:\n\n` +
        dishes.map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ`).join('\n'),
      products: dishes.map(this.formatProduct),
      quickReplies: ['Món này có cay không?', 'Tôi muốn đặt bàn', 'Xem toàn bộ thực đơn'],
    };
  }

  /**
   * 5. Tìm món không cay / ít cay
   */
  private static async searchMildDishes(msgId: string): Promise<ChatMessageResponse> {
    const dishes = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        spicyLevel: { in: ['NONE', 'MILD'] },
      },
      take: 4,
      orderBy: [{ rating: 'desc' }, { soldCount: 'desc' }],
      include: { category: true },
    });

    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, nếu bạn không ăn cay hoặc đi cùng trẻ nhỏ, Hương Sen gợi ý các món thanh nhẹ, thơm dịu sau:\n\n` +
        dishes.map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ`).join('\n') +
        `\n\nNgoài ra, khi gọi món bạn cũng có thể ghi chú cho đầu bếp "Không cay / Không ớt" nhé!`,
      products: dishes.map(this.formatProduct),
      quickReplies: ['Món nào bán chạy?', 'Tôi muốn đặt bàn', 'Thêm vào giỏ'],
    };
  }

  /**
   * 6. Kiểm tra tình trạng món cụ thể (Còn hay hết món)
   */
  private static async checkDishAvailability(rawMsg: string, norm: string, msgId: string): Promise<ChatMessageResponse | null> {
    // Tìm các từ khóa món
    const words = rawMsg
      .replace(/(mon nay|mon|con khong|het chua|co con|khong)/gi, '')
      .trim();

    if (!words || words.length < 2) return null;

    const dish = await prisma.dish.findFirst({
      where: {
        OR: [
          { name: { contains: words } },
          { slug: { contains: normalizeVietnamese(words).replace(/\s+/g, '-') } },
        ],
      },
      include: { category: true },
    });

    if (!dish) return null;

    if (dish.isAvailable) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, món **${dish.name}** hiện **ĐANG CÒN PHỤC VỤ** với giá ${(dish.discountedPrice || dish.price).toLocaleString('vi-VN')}đ.\n\nMón được chế biến tươi nóng từ nguyên liệu tươi trong ngày ạ!`,
        products: [this.formatProduct(dish)],
        quickReplies: ['Thêm món này vào giỏ', 'Gợi ý món ăn kèm', 'Xem thực đơn'],
      };
    } else {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ rất tiếc, món **${dish.name}** hôm nay hiện **TẠM HẾT SUẤT** do đã hết nguyên liệu tươi trong ngày. Bạn có thể tham khảo các món đặc sắc khác cùng danh mục ${dish.category?.name || 'món ngon'} nhé!`,
        products: [this.formatProduct(dish)],
        quickReplies: ['Món nào được gọi nhiều?', 'Xem thực đơn đầy đủ'],
      };
    }
  }

  /**
   * 7. Tư vấn thực đơn theo số người (Dựa trên dữ liệu món thật)
   */
  private static async getRecommendation(rawMsg: string, norm: string, msgId: string): Promise<ChatMessageResponse> {
    const isTwo = norm.includes('2') || norm.includes('hai');

    // Lấy 1 món khai vị, 1 món chính, 1 món cơm/canh
    const [appetizers, mains, souporrice] = await Promise.all([
      prisma.dish.findMany({
        where: { isAvailable: true, category: { slug: { in: ['khai-vi', 'salad-goi'] } } },
        take: 1,
        orderBy: { soldCount: 'desc' },
        include: { category: true },
      }),
      prisma.dish.findMany({
        where: { isAvailable: true, category: { slug: { in: ['mon-ga', 'mon-ca', 'mon-bo', 'mon-heo'] } } },
        take: isTwo ? 1 : 2,
        orderBy: { soldCount: 'desc' },
        include: { category: true },
      }),
      prisma.dish.findMany({
        where: { isAvailable: true, category: { slug: { in: ['com-nieu', 'canh-lau', 'mon-canh'] } } },
        take: 1,
        orderBy: { soldCount: 'desc' },
        include: { category: true },
      }),
    ]);

    const combo = [...appetizers, ...mains, ...souporrice];
    const totalEst = combo.reduce((sum, d) => sum + (d.discountedPrice || d.price), 0);

    const title = isTwo ? 'bữa ăn 2 người ấm cúng' : 'bữa ăn 4 người / gia đình';
    const comboText = combo
      .map((d) => `• **${d.name}** (${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ)`)
      .join('\n');

    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, nếu bạn đi ${title}, Hương Sen xin gợi ý mâm cơm chuẩn vị gồm khai vị, món chính và canh nóng:\n\n${comboText}\n\n👉 **Tổng ước tính:** khoảng **${totalEst.toLocaleString('vi-VN')}đ**. Bạn có thể bấm thêm từng món vào giỏ hoặc đặt bàn trước để quán giữ chỗ nhé!`,
      products: combo.map(this.formatProduct),
      quickReplies: ['Tôi muốn đặt bàn', 'Món nào ít cay?', 'Xem toàn bộ thực đơn'],
      action: { type: 'open_reserve', payload: '/reserve' },
    };
  }

  /**
   * 8. Tìm kiếm thực đơn theo từ khóa
   */
  private static async searchMenuByKeyword(rawMsg: string, norm: string, msgId: string): Promise<ChatMessageResponse | null> {
    // 1. Loại bỏ các ký tự dấu câu phổ biến
    const strippedRaw = rawMsg.replace(/[?!.,;:()]/g, ' ').trim();
    const strippedNorm = norm.replace(/[?!.,;:()]/g, ' ').trim();

    // 2. Trích xuất từ khóa tìm kiếm (bỏ các từ nối tiếng Việt)
    const stopWords = ['co', 'mon', 'khong', 'nha hang co', 'quan co', 'cho toi hoi', 'tim', 'xem', 'cac', 'nhung', 'gi'];
    let cleanNorm = strippedNorm;
    for (const w of stopWords) {
      cleanNorm = cleanNorm.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    }

    let cleanRaw = strippedRaw;
    const rawStopWords = ['Có', 'có', 'món', 'Món', 'không', 'Không', 'nhà hàng có', 'quán có', 'cho tôi hỏi', 'tìm', 'xem', 'các', 'những', 'gì'];
    for (const rw of rawStopWords) {
      cleanRaw = cleanRaw.replace(new RegExp(`\\b${rw}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    }

    const searchTerm = cleanRaw.length >= 2 ? cleanRaw : cleanNorm;
    if (searchTerm.length < 2) return null;

    // 3. Mapping từ khóa phổ biến sang tên hoặc slug danh mục
    let categorySearchTerm: string | undefined = undefined;
    if (cleanNorm === 'ga' || cleanNorm.includes('thit ga')) categorySearchTerm = 'Gà';
    else if (cleanNorm === 'bo' || cleanNorm.includes('thit bo')) categorySearchTerm = 'Bò';
    else if (cleanNorm === 'heo' || cleanNorm === 'lon' || cleanNorm.includes('thit heo')) categorySearchTerm = 'Heo';
    else if (cleanNorm === 'ca' || cleanNorm.includes('mon ca')) categorySearchTerm = 'Cá';
    else if (cleanNorm === 'hai san' || cleanNorm === 'tom' || cleanNorm === 'muc' || cleanNorm === 'cua') categorySearchTerm = 'Hải Sản';
    else if (cleanNorm === 'com' || cleanNorm === 'com nieu') categorySearchTerm = 'Cơm';
    else if (cleanNorm === 'bun' || cleanNorm === 'pho' || cleanNorm === 'mi') categorySearchTerm = 'Phở';
    else if (cleanNorm === 'lau' || cleanNorm === 'canh') categorySearchTerm = 'Canh';
    else if (cleanNorm === 'trang mieng' || cleanNorm === 'che') categorySearchTerm = 'Tráng Miệng';
    else if (cleanNorm === 'nuoc' || cleanNorm === 'do uong' || cleanNorm === 'ca phe' || cleanNorm === 'sinh to') categorySearchTerm = 'Đồ Uống';
    else if (cleanNorm === 'salad' || cleanNorm === 'goi') categorySearchTerm = 'Salad';

    const orConditions: any[] = [
      { name: { contains: searchTerm } },
      { shortDescription: { contains: searchTerm } },
      { description: { contains: searchTerm } },
      { category: { name: { contains: searchTerm } } },
    ];

    if (categorySearchTerm) {
      orConditions.push({ category: { name: { contains: categorySearchTerm } } });
      orConditions.push({ name: { contains: categorySearchTerm } });
    }

    const dishes = await prisma.dish.findMany({
      where: {
        isAvailable: true,
        OR: orConditions,
      },
      take: 4,
      orderBy: [{ isBestSeller: 'desc' }, { soldCount: 'desc' }, { rating: 'desc' }],
      include: { category: true },
    });

    if (dishes.length === 0) return null;

    const displayTerm = categorySearchTerm || searchTerm;
    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, Hương Sen có các món **${displayTerm}** tươi ngon, chuẩn vị sau đây dành cho bạn:\n\n` +
        dishes.map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ (★ ${d.rating.toFixed(1)})`).join('\n') +
        `\n\nBạn có thể bấm vào món để xem chi tiết hoặc thêm vào giỏ nhé!`,
      products: dishes.map(this.formatProduct),
      quickReplies: ['Xem thêm món khác', 'Tôi muốn đặt bàn', 'Món nào bán chạy?'],
    };
  }

  /**
   * 9. Xử lý đặt bàn & kiểm tra bàn trống
   */
  private static async handleReservationInquiry(rawMsg: string, norm: string, msgId: string): Promise<ChatMessageResponse> {
    // Kiểm tra số lượng bàn còn trống hiện tại từ database
    const availableTables = await prisma.table.count({
      where: { status: 'available', isActive: true },
    });

    // Trích xuất số khách nếu có
    const guestMatch = rawMsg.match(/(\d+)\s*(nguoi|khach)/i) || norm.match(/(\d+)\s*(nguoi|khach)/);
    const guestCount = guestMatch ? parseInt(guestMatch[1]) : null;

    let responseText = `Dạ, nhà hàng **Hương Sen** rất hân hạnh được đón tiếp bạn! Hiện tại nhà hàng đang có **${availableTables} bàn trống** sẵn sàng đón khách.\n\n`;

    if (guestCount) {
      responseText += `Bạn đang muốn đặt bàn cho **${guestCount} người**. Bạn có thể bấm nút **Đặt Bàn Ngay** bên dưới để chọn ngày giờ và không gian ưng ý (Sảnh Mộc, Hiên Sen hoặc Phòng VIP) nhé!`;
    } else {
      responseText += `Bạn dự định đi bao nhiêu người và đến vào ngày nào ạ?\n• Đặt trước từ 10 khách được hỗ trợ phòng riêng VIP\n• Quán giữ bàn trong 15 phút so với giờ hẹn`;
    }

    return {
      id: msgId,
      role: 'assistant',
      text: responseText,
      quickReplies: [
        'Đặt bàn 2 người',
        'Đặt bàn 4 người',
        'Đặt bàn 6 người',
        'Xem thực đơn món ăn',
      ],
      action: {
        type: 'open_reserve',
        payload: guestCount ? `/reserve?guests=${guestCount}` : '/reserve',
      },
    };
  }

  /**
   * 10. Tra cứu đơn hàng thật từ database (Chống IDOR & rò rỉ dữ liệu)
   */
  private static async lookupOrder(query: string, msgId: string): Promise<ChatMessageResponse> {
    const cleanQ = query.trim();

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { code: cleanQ },
          { customerPhone: cleanQ },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        table: true,
        orderItems: {
          include: { dish: true },
        },
      },
    });

    if (orders.length === 0) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, Hương Sen không tìm thấy đơn hàng nào khớp với thông tin "${cleanQ}".\n\nBạn vui lòng kiểm tra lại chính xác Mã đơn hàng (VD: HS-...) hoặc Số điện thoại đặt hàng nhé!`,
        quickReplies: ['Tra cứu lại', 'Liên hệ hotline', 'Xem thực đơn'],
      };
    }

    const order = orders[0];
    const statusLabels: Record<string, string> = {
      pending: '⏳ Chờ Quán Tiếp Nhận',
      confirmed: '✅ Đã Tiếp Nhận',
      preparing: '🍳 Bếp Đang Nấu Món',
      ready: '🔔 Món Đã Sẵn Sàng',
      served: '🍽️ Đã Phục Vụ Tại Bàn',
      out_for_delivery: '🛵 Đang Giao Hàng',
      completed: '✨ Hoàn Tất',
      cancelled: '❌ Đã Hủy',
    };

    const itemsSummary = order.orderItems
      .slice(0, 3)
      .map((it) => `• ${it.quantity}x ${it.dishNameSnapshot || it.dish?.name || 'Món'}`)
      .join('\n');

    const moreText = order.orderItems.length > 3 ? `\n• ...và ${order.orderItems.length - 3} món khác` : '';

    return {
      id: msgId,
      role: 'assistant',
      text: `Thông tin đơn hàng **#${order.code}**:\n\n` +
        `• **Trạng thái:** ${statusLabels[order.status] || order.status}\n` +
        `• **Số món:** ${order.orderItems.length} món\n` +
        `• **Tổng tiền:** ${order.totalAmount.toLocaleString('vi-VN')}đ\n` +
        `• **Chi tiết:**\n${itemsSummary}${moreText}\n\n` +
        (order.status === 'preparing'
          ? '👉 Bếp Hương Sen đang chuẩn bị món ăn tươi nóng cho bạn. Trạng thái sẽ được cập nhật tự động ngay trên khung chat này!'
          : ''),
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.orderItems.map((it) => ({
          name: it.dishNameSnapshot || it.dish?.name,
          quantity: it.quantity,
          price: it.unitPrice,
        })),
      },
      quickReplies: ['Kiểm tra lại', 'Xem thực đơn', 'Gọi tính tiền'],
      action: { type: 'view_order', payload: `/order-lookup?q=${encodeURIComponent(order.code)}` },
    };
  }

  /**
   * 11. Xử lý yêu cầu gọi tính tiền từ Chatbox
   */
  private static async handlePaymentRequest(context: ChatContext, msgId: string): Promise<ChatMessageResponse> {
    if (context.tableToken) {
      // Tìm bàn từ token
      const table = await prisma.table.findUnique({
        where: { qrToken: context.tableToken },
        include: {
          sessions: {
            where: { isActive: true },
            include: {
              orders: {
                where: { status: { notIn: ['completed', 'cancelled'] } },
                take: 1,
              },
            },
          },
        },
      });

      const activeOrder = table?.sessions?.[0]?.orders?.[0];
      if (activeOrder) {
        broadcastEvent(SocketEvents.BILL_REQUESTED, {
          orderId: activeOrder.id,
          orderCode: activeOrder.code,
          tableNumber: table.tableNumber,
          totalAmount: activeOrder.totalAmount,
        });

        return {
          id: msgId,
          role: 'assistant',
          text: `Dạ, mình đã gửi thông báo yêu cầu thanh toán cho **Bàn ${table.tableNumber}** (Đơn #${activeOrder.code} - ${activeOrder.totalAmount.toLocaleString('vi-VN')}đ) đến quầy Thu ngân!\n\nNhân viên sẽ mang hóa đơn và máy quẹt thẻ tới bàn ngay trong giây lát ạ.`,
          quickReplies: ['Cảm ơn nhà hàng', 'Xem thực đơn'],
        };
      }
    }

    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, nếu bạn đang ngồi tại bàn trong nhà hàng, bạn có thể quét mã QR trên bàn để gửi yêu cầu thanh toán tức thì, hoặc báo với bạn nhân viên phục vụ gần nhất để được mang hóa đơn tới bàn nhé!',
      quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Liên hệ hotline'],
    };
  }

  /**
   * Helper định dạng món ăn trả về cho ChatProductCard
   */
  private static formatProduct(dish: any) {
    return {
      id: dish.id,
      name: dish.name,
      slug: dish.slug,
      price: dish.price,
      discountedPrice: dish.discountedPrice,
      imageUrl: dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
      rating: dish.rating || 5.0,
      reviewCount: dish.reviewCount || 0,
      isAvailable: dish.isAvailable,
      shortDescription: dish.shortDescription || dish.description || '',
      categoryName: dish.category?.name || 'Món ngon',
      spicyLevel: dish.spicyLevel || 'NONE',
    };
  }
}
