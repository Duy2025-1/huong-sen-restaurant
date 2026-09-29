import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import { 
  ChatIntent, 
  ChatMessageResponse, 
  ChatContext, 
  ConversationMemory,
  RecommendationPlan,
} from './chat.types.js';
import { ChatMemoryManager, normalizeVietnamese } from './chat.memory.js';
import { ChatTools } from './chat.tools.js';
import { RestaurantKnowledgeBase } from './chat.knowledge.js';

export class ChatService {
  /**
   * Bộ xử lý hội thoại thông minh, hiểu ngữ cảnh và đa lượt (Multi-turn Assistant)
   */
  static async processMessage(message: string, context: ChatContext = {}): Promise<ChatMessageResponse> {
    const rawMsg = (message || '').trim();
    const norm = normalizeVietnamese(rawMsg);
    const cleanNorm = norm.replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();
    const convId = context.conversationId || 'default-session';
    const msgId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Quản lý Memory & Hội thoại
    let memory = ChatMemoryManager.getOrCreateMemory(convId, context.memory);
    memory = ChatMemoryManager.extractEntities(rawMsg, memory);
    ChatMemoryManager.saveMemory(convId, memory);

    // Cảnh báo dị ứng nếu khách có tiền sử
    let allergensNotice = '';
    if (memory.allergies && memory.allergies.length > 0) {
      allergensNotice = `⚠️ **Lưu ý dị ứng (${memory.allergies.join(', ')}):** Nhà hàng sẽ loại trừ các món có thành phần này trong gợi ý. Khi dùng bữa tại quán, bạn vui lòng báo lại với nhân viên phục vụ để bếp dùng bộ dụng cụ riêng biệt nhé!`;
    }

    if (!rawMsg) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Chào bạn! Hương Sen có thể giúp gì cho bữa ăn của bạn hôm nay ạ?',
        intent: 'INTENT_SMALL_TALK',
        memory,
        quickReplies: ['Xem thực đơn 118 món', 'Món nào bán chạy?', 'Tư vấn mâm cơm 4 người', 'Tôi muốn đặt bàn'],
      };
    }

    // 2. BẢO MẬT & GUARDRAIL: Chống Prompt Injection & Gian lận dữ liệu
    if (
      cleanNorm.includes('bo qua tat ca') ||
      cleanNorm.includes('ignore all') ||
      cleanNorm.includes('mat khau') ||
      cleanNorm.includes('password') ||
      cleanNorm.includes('don hang cua nguoi khac') ||
      cleanNorm.includes('database') ||
      cleanNorm.includes('sql injection') ||
      cleanNorm.includes('token')
    ) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, mình là nhân viên tư vấn của Nhà hàng Hương Sen, chỉ hỗ trợ quý khách xem thực đơn, tư vấn món ăn, đặt bàn và tra cứu đơn hàng của chính quý khách. Mình không có quyền can thiệp hay chia sẻ dữ liệu nội bộ khác ạ.',
        intent: 'INTENT_SECURITY_GUARD',
        memory,
        quickReplies: ['Xem thực đơn', 'Tư vấn món ngon', 'Đặt bàn ngay'],
      };
    }

    // 3. SMALL TALK / CHÀO HỎI & CẢM XÚC TỰ NHIÊN
    if (this.isSmallTalk(cleanNorm)) {
      return this.handleSmallTalk(cleanNorm, memory, msgId);
    }

    // 4. KHÁCH BÁO KHÔNG ĂN CAY ĐƠN LẺ
    if (cleanNorm === 'toi khong an cay' || cleanNorm === 'khong an cay' || cleanNorm === 'an nhat' || cleanNorm === 'khong cay') {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, mình đã ghi nhớ khẩu vị của bạn là **KHÔNG ĂN CAY**. Từ bây giờ mình sẽ ưu tiên đề xuất các món thanh nhẹ, không ớt cho bạn nhé!\n\nBạn muốn mình gợi ý món cá, gà, cơm niêu hay lẩu không cay ạ?',
        intent: 'INTENT_CHECK_SPICY_LEVEL',
        memory,
        quickReplies: ['Món cá không cay', 'Cơm niêu gia đình', 'Lẩu không cay', 'Món nào bán chạy?'],
      };
    }

    // 5. KHÁCH BÁO DỊ ỨNG ĐƠN LẺ
    if (cleanNorm.startsWith('toi di ung') || cleanNorm.startsWith('di ung')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, mình đã ghi nhận thông tin bạn **dị ứng ${memory.allergies.join(', ') || 'thực phẩm'}** và sẽ loại trừ các món có thành phần này trong danh sách gợi ý.\n\n⚠️ **Lưu ý an toàn:** Để loại trừ hoàn toàn nguy cơ nhiễm chéo trong gian bếp, bạn vui lòng nhắc lại với bạn nhân viên phục vụ khi đến quán để bếp dùng dụng cụ riêng nhé! Bạn muốn mình gợi ý món khai vị hay món chính nào ạ?`,
        intent: 'INTENT_CHECK_ALLERGEN',
        memory,
        quickReplies: ['Gợi ý món khai vị', 'Món cá kho', 'Cơm niêu gia đình'],
      };
    }

    // 6. KHÁCH BÁO SỐ NGƯỜI ĐƠN LẺ ("Tôi đi 4 người.", "Nhà mình 2 người.")
    if (
      (cleanNorm.startsWith('toi di') || cleanNorm.startsWith('nha minh') || cleanNorm.startsWith('nhom minh') || cleanNorm.match(/^(\d+|hai|ba|bon|nam|sau)\s*nguoi$/)) &&
      !cleanNorm.includes('khoang') &&
      !cleanNorm.includes('k') &&
      memory.foodPreferences.length === 0
    ) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, bạn muốn mình tư vấn món cho **${memory.numberOfPeople || 4} người** nhé! Bạn dự định ngân sách khoảng bao nhiêu (VD: 500k–700k) và thích dùng cơm gia đình ấm cúng, món nướng hay lẩu sum vầy ạ?`,
        intent: 'INTENT_RECOMMEND_FOOD',
        memory,
        quickReplies: ['Khoảng 500k', 'Khoảng 700k', 'Món Việt truyền thống', 'Tôi muốn ăn lẩu'],
      };
    }

    // 7. CHỌN PHƯƠNG ÁN / COMBO ĐÃ TƯ VẤN TRƯỚC ĐÓ ("Tôi chọn phương án 2", "Lấy combo 1")
    if (
      cleanNorm.includes('chon phuong an') ||
      cleanNorm.includes('lay phuong an') ||
      cleanNorm.includes('phuong an 1') ||
      cleanNorm.includes('phuong an 2') ||
      cleanNorm.includes('phuong an 3') ||
      cleanNorm.includes('chon combo')
    ) {
      const planRes = this.handlePlanSelection(cleanNorm, memory, msgId);
      if (planRes) return planRes;
    }

    // 8. THÊM VÀO GIỎ HÀNG TỪ CHAT ("Thêm món đó vào giỏ", "Thêm gà nướng vào giỏ")
    if (
      cleanNorm.includes('them vao gio') ||
      cleanNorm.includes('cho vao gio') ||
      cleanNorm.includes('dat mon do') ||
      cleanNorm.includes('lay mon nay') ||
      cleanNorm.includes('them mon nay')
    ) {
      const cartRes = await this.handleAddToCartRequest(rawMsg, cleanNorm, memory, context, msgId);
      if (cartRes) return cartRes;
    }

    // 9. SO SÁNH 2 MÓN ĂN ("Cá lóc nướng và cá kho tộ khác nhau thế nào?")
    if (cleanNorm.includes('khac nhau the nao') || cleanNorm.includes('so sanh') || cleanNorm.includes('hay la') || cleanNorm.includes('nen chon')) {
      const compareRes = await this.handleDishComparison(rawMsg, cleanNorm, memory, msgId);
      if (compareRes) return compareRes;
    }

    // 10. HỎI ĐỘ CAY ("Món này có cay không?", "Cá kho có cay không?")
    if (cleanNorm.includes('co cay khong') || cleanNorm.includes('cay lam khong') || cleanNorm.includes('do cay')) {
      const spicyRes = await this.handleSpicyCheck(rawMsg, cleanNorm, memory, context, msgId);
      if (spicyRes) return spicyRes;
    }

    // 11. HỎI NGUYÊN LIỆU & THÀNH PHẦN ("Những món này có nguyên liệu gì?", "Món này nấu từ gì?")
    if (
      cleanNorm.includes('nguyen lieu') ||
      cleanNorm.includes('thanh phan') ||
      cleanNorm.includes('nau tu gi') ||
      cleanNorm.includes('co nhung gi') ||
      cleanNorm.includes('la mon gi')
    ) {
      const explainRes = await this.handleDishExplanation(rawMsg, cleanNorm, memory, context, msgId);
      if (explainRes) return explainRes;
    }

    // 12. HỎI REVIEW & ĐÁNH GIÁ CỦA THỰC KHÁCH KHÁC ("Món này ngon không?", "Khách đánh giá thế nào?")
    if (cleanNorm.includes('danh gia') || cleanNorm.includes('review') || cleanNorm.includes('an ngon khong') || cleanNorm.includes('nhan xet')) {
      const reviewRes = await this.handleReviewInquiry(rawMsg, cleanNorm, memory, context, msgId);
      if (reviewRes) return reviewRes;
    }

    // 13. GỌI TÍNH TIỀN / YÊU CẦU THANH TOÁN
    if (
      cleanNorm.includes('thanh toan') ||
      cleanNorm.includes('tinh tien') ||
      cleanNorm.includes('goi tinh tien') ||
      cleanNorm.includes('lay hoa don')
    ) {
      return await this.handlePaymentRequest(context, memory, msgId);
    }

    // 14. TRA CỨU ĐƠN HÀNG (THEO MÃ ĐƠN HOẶC SĐT HOẶC USER PROFILE)
    const phoneMatch = rawMsg.match(/0[3|5|7|8|9][0-9]{8}/);
    const orderCodeMatch = rawMsg.match(/HS-\d{8}-\d{3,4}|ORD-\S+/i);

    if (
      orderCodeMatch ||
      phoneMatch ||
      cleanNorm.includes('kiem tra don') ||
      cleanNorm.includes('tra cuu don') ||
      cleanNorm.includes('don cua toi') ||
      cleanNorm.includes('bep lam chua') ||
      cleanNorm.includes('don dang o dau')
    ) {
      const queryParam = orderCodeMatch ? orderCodeMatch[0] : phoneMatch ? phoneMatch[0] : context.customerPhone || (context.user?.phone ?? null);
      if (queryParam) {
        return await this.lookupOrder(queryParam, memory, msgId);
      } else {
        return {
          id: msgId,
          role: 'assistant',
          text: 'Dạ, để kiểm tra tiến trình đơn hàng, bạn vui lòng gửi cho mình **Mã đơn hàng** (VD: `HS-20260928-0001`) hoặc **Số điện thoại** dùng khi đặt món nhé!',
          intent: 'INTENT_ORDER_LOOKUP',
          memory,
          quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Liên hệ hotline'],
        };
      }
    }

    // 15. ĐẶT BÀN / KIỂM TRA BÀN TRỐNG
    if (
      cleanNorm.includes('dat ban') ||
      cleanNorm.includes('giu ban') ||
      cleanNorm.includes('con ban khong') ||
      cleanNorm.includes('dat cho') ||
      cleanNorm.includes('book ban')
    ) {
      return await this.handleReservationInquiry(rawMsg, cleanNorm, memory, msgId);
    }

    // 16. THÔNG TIN NHÀ HÀNG (GIỜ MỞ CỬA, ĐỊA CHỈ, HOTLINE, CHÍNH SÁCH)
    if (
      cleanNorm.includes('mo cua') ||
      cleanNorm.includes('dong cua') ||
      cleanNorm.includes('may gio') ||
      cleanNorm.includes('dia chi') ||
      cleanNorm.includes('o dau') ||
      cleanNorm.includes('vi tri') ||
      cleanNorm.includes('hotline') ||
      cleanNorm.includes('so dien thoai') ||
      cleanNorm.includes('lien he') ||
      cleanNorm.includes('phuong thuc thanh toan') ||
      cleanNorm.includes('chinh sach')
    ) {
      return this.handleRestaurantInfo(cleanNorm, memory, msgId);
    }

    // 17. KIỂM TRA TÌNH TRẠNG MÓN CÒN HAY HẾT (AVAILABILITY)
    if (cleanNorm.includes('con khong') || cleanNorm.includes('het chua') || cleanNorm.includes('co con')) {
      const availRes = await this.handleAvailabilityCheck(rawMsg, cleanNorm, memory, context, msgId);
      if (availRes) return availRes;
    }

    // 18. TƯ VẤN THEO BỮA / SỐ NGƯỜI / NGÂN SÁCH / HOÀN CẢNH (FOOD RECOMMENDATION ENGINE)
    if (
      cleanNorm.includes('nguoi') ||
      cleanNorm.includes('gia dinh') ||
      cleanNorm.includes('goi y') ||
      cleanNorm.includes('tu van') ||
      cleanNorm.includes('nen an gi') ||
      cleanNorm.includes('nen goi gi') ||
      cleanNorm.includes('mot bua') ||
      cleanNorm.includes('an com') ||
      cleanNorm.includes('troi mua') ||
      cleanNorm.includes('met') ||
      cleanNorm.includes('phuong an') ||
      cleanNorm.includes('thuc don') ||
      (memory.numberOfPeople && (cleanNorm.includes('khoang') || cleanNorm.includes('k') || cleanNorm.includes('trieu') || cleanNorm.includes('tram') || cleanNorm.includes('truyen thong')))
    ) {
      return await this.handleFoodRecommendation(rawMsg, cleanNorm, memory, allergensNotice, msgId);
    }

    // 19. MÓN BÁN CHẠY / ĐƯỢC GỌI NHIỀU / ĐẶC TRƯNG HƯƠNG SEN
    if (
      cleanNorm.includes('duoc goi nhieu') ||
      cleanNorm.includes('ban chay') ||
      cleanNorm.includes('best seller') ||
      cleanNorm.includes('dac trung') ||
      cleanNorm.includes('ngon nhat') ||
      cleanNorm.includes('noi bat') ||
      cleanNorm.includes('mon hot')
    ) {
      return await this.handleBestSellers(memory, msgId);
    }

    // 20. TÌM KIẾM THEO TẦM GIÁ (DƯỚI 150K, 200K, GIÁ RẺ)
    if (memory.budget || cleanNorm.includes('gia re') || cleanNorm.includes('duoi')) {
      const priceSearch = await this.handlePriceSearch(memory, msgId);
      if (priceSearch) return priceSearch;
    }

    // 21. TÌM KIẾM THEO TỪ KHÓA MÓN HOẶC NGUYÊN LIỆU CỤ THỂ
    const keywordSearch = await this.handleKeywordSearch(rawMsg, cleanNorm, memory, msgId);
    if (keywordSearch) {
      return keywordSearch;
    }

    // 22. FALLBACK TỰ NHIÊN, KHÔNG MÁY MÓC
    ChatMemoryManager.saveMemory(convId, memory);
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, Hương Sen chưa tìm thấy thông tin phù hợp với yêu cầu này trên thực đơn hiện tại. Bạn có muốn mình gợi ý vài món đặc sắc được gọi nhiều nhất của quán, hay bạn muốn xem toàn bộ 118 món thuần Việt trên website ạ?',
      intent: 'INTENT_UNKNOWN',
      memory,
      quickReplies: ['Xem thực đơn', 'Món nào bán chạy?', 'Tư vấn mâm cơm 4 người', 'Tôi muốn đặt bàn'],
      action: { type: 'view_menu', payload: '/menu' },
    };
  }

  /**
   * Xử lý Small Talk tự nhiên
   */
  private static isSmallTalk(cleanNorm: string): boolean {
    const smallTalkKeywords = [
      'xin chao', 'chao ban', 'chao em', 'hello', 'hi',
      'cam on', 'thank', 'da ta',
      'ok', 'duoc roi', 'da ro', 'nhat tri',
      'haha', 'hihi', 'vui qua',
      'hay do', 'tuyet voi', 'good',
      'toi dang phan van', 'chua biet an gi',
    ];
    return smallTalkKeywords.some((k) => cleanNorm === k || cleanNorm.startsWith(`${k} `));
  }

  private static handleSmallTalk(cleanNorm: string, memory: ConversationMemory, msgId: string): ChatMessageResponse {
    if (cleanNorm.includes('cam on') || cleanNorm.includes('thank')) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ không có chi ạ! Hương Sen rất vui được hỗ trợ bạn. Bạn cần tư vấn thêm món ăn hay đặt bàn trước thì cứ nhắn mình nhé!',
        intent: 'INTENT_SMALL_TALK',
        memory,
        quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Món nào bán chạy?'],
      };
    }

    if (cleanNorm.includes('haha') || cleanNorm.includes('hihi') || cleanNorm.includes('hay do') || cleanNorm.includes('tuyet')) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ vâng ạ! Bạn có muốn mình gợi ý thêm món tráng miệng hoặc đồ uống thanh mát cho trọn vẹn bữa ăn không ạ?',
        intent: 'INTENT_SMALL_TALK',
        memory,
        quickReplies: ['Món tráng miệng', 'Đồ uống giải nhiệt', 'Tôi muốn đặt bàn'],
      };
    }

    if (cleanNorm.includes('phan van') || cleanNorm.includes('chua biet')) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Đừng lo bạn nhé! Bạn đi mấy người và thích ăn cá, gà, thịt hay một nồi lẩu ấm cúng? Mình sẽ lên ngay mâm cơm chuẩn vị cho bạn lựa chọn.',
        intent: 'INTENT_SMALL_TALK',
        memory,
        quickReplies: ['Đi 2 người', 'Đi 4 người', 'Thích món cá', 'Thích ăn lẩu'],
      };
    }

    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ Hương Sen xin chào bạn! Hôm nay bạn dự định dùng bữa mấy người để mình tư vấn mâm cơm hợp khẩu vị nhất ạ?',
      intent: 'INTENT_SMALL_TALK',
      memory,
      quickReplies: ['Đi 2 người', 'Đi 4 người / Gia đình', 'Món nào bán chạy?', 'Xem thực đơn'],
    };
  }

  /**
   * Xử lý chọn Phương án Combo đã đề xuất ("Tôi chọn phương án 2")
   */
  private static handlePlanSelection(cleanNorm: string, memory: ConversationMemory, msgId: string): ChatMessageResponse | null {
    if (!memory.lastRecommendations || memory.lastRecommendations.length === 0) return null;

    let selectedPlan: RecommendationPlan | undefined;
    if (cleanNorm.includes('phuong an 1') || cleanNorm.includes('combo 1')) selectedPlan = memory.lastRecommendations.find((p) => p.planId === 1);
    else if (cleanNorm.includes('phuong an 2') || cleanNorm.includes('combo 2')) selectedPlan = memory.lastRecommendations.find((p) => p.planId === 2);
    else if (cleanNorm.includes('phuong an 3') || cleanNorm.includes('combo 3')) selectedPlan = memory.lastRecommendations.find((p) => p.planId === 3);

    if (!selectedPlan) return null;

    const dishList = selectedPlan.dishes.map((d) => `• **${d.name}** (${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ)`).join('\n');

    return {
      id: msgId,
      role: 'assistant',
      text: `Tuyệt vời ạ! Bạn đã chọn **${selectedPlan.title}** với tổng tiền **${selectedPlan.subtotal.toLocaleString('vi-VN')}đ** gồm:\n\n${dishList}\n\n👉 Bạn có muốn mình **Thêm tất cả các món này vào giỏ hàng** luôn không ạ?`,
      intent: 'INTENT_CHOOSE_PLAN',
      memory,
      products: selectedPlan.dishes,
      quickReplies: ['Thêm tất cả vào giỏ', 'Tôi muốn đặt bàn', 'Đổi sang phương án khác'],
      action: {
        type: 'add_to_cart',
        label: 'Thêm tất cả vào giỏ',
        payload: { dishes: selectedPlan.dishes },
      },
    };
  }

  /**
   * Xử lý Thêm vào giỏ hàng từ chat
   */
  private static async handleAddToCartRequest(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    // Nếu khách nói "thêm phương án 2 vào giỏ"
    if (cleanNorm.includes('phuong an') || cleanNorm.includes('combo')) {
      const matchPlan = cleanNorm.match(/phuong an\s*(\d)/) || cleanNorm.match(/combo\s*(\d)/);
      const planId = matchPlan ? parseInt(matchPlan[1]) : 1;
      const targetPlan = memory.lastRecommendations?.find((p) => p.planId === planId);
      if (targetPlan) {
        return {
          id: msgId,
          role: 'assistant',
          text: `Dạ, mình đã chuẩn bị các món trong **${targetPlan.title}** (${targetPlan.dishes.length} món - ${targetPlan.subtotal.toLocaleString('vi-VN')}đ). Bạn bấm nút **Xác nhận thêm vào giỏ** bên dưới để đồng bộ vào giỏ hàng website nhé!`,
          intent: 'INTENT_ADD_TO_CART',
          memory,
          products: targetPlan.dishes,
          quickReplies: ['Xem giỏ hàng', 'Tôi muốn đặt bàn'],
          action: {
            type: 'add_to_cart',
            label: 'Xác nhận thêm vào giỏ',
            payload: { dishes: targetPlan.dishes },
          },
        };
      }
    }

    // Nếu khách nói "thêm món này/món đó vào giỏ"
    const targetDish = context.currentDish || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]);
    if (targetDish) {
      const fullDish = await ChatTools.getDishDetails(targetDish.id || targetDish.name);
      if (fullDish) {
        return {
          id: msgId,
          role: 'assistant',
          text: `Dạ, mình đã thêm **${fullDish.name}** (${(fullDish.discountedPrice || fullDish.price).toLocaleString('vi-VN')}đ) vào giỏ hàng của bạn. Bạn muốn gọi thêm món nào khác không ạ?`,
          intent: 'INTENT_ADD_TO_CART',
          memory,
          products: [ChatTools.formatProduct(fullDish)],
          quickReplies: ['Gợi ý món ăn kèm', 'Xem giỏ hàng', 'Tôi muốn đặt bàn'],
          action: {
            type: 'add_to_cart',
            payload: { dishes: [ChatTools.formatProduct(fullDish)] },
          },
        };
      }
    }

    return null;
  }

  /**
   * So sánh 2 món ăn thực tế
   */
  private static async handleDishComparison(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    let nameA = '';
    let nameB = '';

    const vsMatch = rawMsg.match(/(.*)\s+(?:và|va|với|voi)\s+(.*?)\s+(?:khác nhau|khac nhau|thế nào|the nao|hợp lý hơn|hop ly hon)/i);
    if (vsMatch) {
      nameA = vsMatch[1].replace(/(cho toi hoi|so sanh|mon)/gi, '').trim();
      nameB = vsMatch[2].replace(/(mon)/gi, '').trim();
    }

    if (!nameA || !nameB) return null;

    const result = await ChatTools.compareDishes(nameA, nameB);
    if (!result.found || !result.dishA || !result.dishB) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, mình tìm thấy một trong hai món "${result.missing}" chưa có thông tin chính xác trên thực đơn. Bạn có thể kiểm tra lại tên món hoặc xem thực đơn đầy đủ nhé!`,
        intent: 'INTENT_COMPARE_FOOD',
        memory,
        quickReplies: ['Xem thực đơn', 'Món nào bán chạy?'],
      };
    }

    const { dishA, dishB } = result;
    const priceDiff = Math.abs(dishA.price - dishB.price);
    const comparisonText =
      `Dạ, Hương Sen xin so sánh chi tiết giữa hai món ăn:\n\n` +
      `🥘 **${dishA.name}** (${dishA.price.toLocaleString('vi-VN')}đ - ★ ${dishA.rating.toFixed(1)}):\n` +
      `• Phân loại: ${dishA.category} | Khẩu vị cay: ${dishA.spicy}\n` +
      `• Đặc điểm: ${dishA.description}\n\n` +
      `🍲 **${dishB.name}** (${dishB.price.toLocaleString('vi-VN')}đ - ★ ${dishB.rating.toFixed(1)}):\n` +
      `• Phân loại: ${dishB.category} | Khẩu vị cay: ${dishB.spicy}\n` +
      `• Đặc điểm: ${dishB.description}\n\n` +
      `👉 **Gợi ý lựa chọn:** ` +
      (dishA.price === dishB.price
        ? 'Cả hai món có mức giá tương đương. Nếu bạn thích vị đậm đà ăn cơm nóng thì chọn món kho, còn thích cuốn rau thanh mát thì chọn món nướng nhé!'
        : `Món ${dishA.price > dishB.price ? dishA.name : dishB.name} chênh lệch khoảng ${priceDiff.toLocaleString('vi-VN')}đ, khẩu phần và nguyên liệu rất phong phú.`);

    return {
      id: msgId,
      role: 'assistant',
      text: comparisonText,
      intent: 'INTENT_COMPARE_FOOD',
      memory,
      products: [dishA, dishB],
      quickReplies: [`Chọn ${dishA.name}`, `Chọn ${dishB.name}`, 'Xem thực đơn'],
    };
  }

  /**
   * Kiểm tra độ cay của món
   */
  private static async handleSpicyCheck(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    let target = context.currentDish?.name;
    if (!target) {
      target = rawMsg
        .replace(/(mon nay|mon do|mon|co cay khong|cay lam khong|do cay|cho toi hoi|co)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!target) return null;

    const dish = await ChatTools.getDishDetails(target);
    if (!dish) return null;

    const spicyDescriptions: Record<string, string> = {
      NONE: 'hoàn toàn **KHÔNG CAY**, trẻ em và người không ăn cay đều dùng rất ngon miệng.',
      MILD: 'có vị **CAY NHẸ** thoang thoảng của tiêu Phú Quốc, rất dễ ăn.',
      MEDIUM: 'có độ **CAY VỪA** chuẩn vị truyền thống.',
      HOT: 'vị **CAY NỒNG ĐẬM ĐÀ** từ ớt xiêm.',
      EXTRA_HOT: 'rất cay.',
    };

    const desc = spicyDescriptions[dish.spicyLevel] || 'độ cay vừa phải';

    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, món **${dish.name}** ${desc}\n\nNgoài ra, khi đặt món bạn có thể ghi chú riêng cho đầu bếp: *"Không ớt / Ít cay"* để bếp gia giảm gia vị phù hợp nhất nhé!`,
      intent: 'INTENT_CHECK_SPICY_LEVEL',
      memory,
      products: [ChatTools.formatProduct(dish)],
      quickReplies: ['Thêm món này vào giỏ', 'Gợi ý món không cay', 'Xem thực đơn'],
    };
  }

  /**
   * Giải thích món ăn & nguyên liệu
   */
  private static async handleDishExplanation(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    let target = context.currentDish?.name;
    if (!target) {
      target = rawMsg
        .replace(/(la mon gi|nguyen lieu|thanh phan|nau tu gi|co nhung gi|mon nay|mon do|cho toi hoi|la gi|co|gi|mon)/gi, ' ')
        .replace(/(là món gì|nguyên liệu|thành phần|nấu từ gì|có những gì|món này|món đó|cho tôi hỏi|là gì|có|gì|món)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!target) return null;

    const dish = await ChatTools.getDishDetails(target);
    if (!dish) return null;

    let ingredientsList = '';
    try {
      const ing = JSON.parse(dish.ingredients || '[]');
      if (Array.isArray(ing) && ing.length > 0) {
        ingredientsList = `\n• **Nguyên liệu chính:** ${ing.join(', ')}`;
      }
    } catch {
      // ignore
    }

    return {
      id: msgId,
      role: 'assistant',
      text: `🥘 **${dish.name}** (${(dish.discountedPrice || dish.price).toLocaleString('vi-VN')}đ):\n\n` +
        `• **Mô tả:** ${dish.description || dish.shortDescription || 'Món ăn thuần Việt thơm ngon chuẩn vị quê nhà.'}` +
        `${ingredientsList}\n` +
        `• **Khẩu phần:** ${dish.servingSize || '1 phần'}\n` +
        `• **Độ cay:** ${dish.spicyLevel === 'NONE' ? 'Không cay' : dish.spicyLevel === 'MILD' ? 'Cay nhẹ' : 'Cay vừa'}`,
      intent: 'INTENT_EXPLAIN_FOOD',
      memory,
      products: [ChatTools.formatProduct(dish)],
      quickReplies: ['Món này có cay không?', 'Thêm vào giỏ', 'Gợi ý món ăn kèm'],
    };
  }

  /**
   * Đọc đánh giá thực tế của món
   */
  private static async handleReviewInquiry(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    let target = context.currentDish?.name;
    if (!target) {
      target = rawMsg
        .replace(/(danh gia|review|an ngon khong|nhan xet|mon nay|mon do|mon|khach|the nao)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!target) return null;

    const dish = await ChatTools.getDishDetails(target);
    if (!dish) return null;

    const reviewsData = await ChatTools.getDishReviews(dish.id);
    let reviewSummary = `Món **${dish.name}** hiện đạt **★ ${reviewsData.rating.toFixed(1)}/5.0** dựa trên **${reviewsData.reviewCount} lượt đánh giá** từ thực khách.\n\n`;

    if (reviewsData.reviews.length > 0) {
      reviewSummary += `Một số phản hồi thực tế từ khách hàng:\n` +
        reviewsData.reviews.slice(0, 2).map((r) => `💬 *" ${r.comment} "* — Khách hàng **${r.userName}** (★ ${r.rating})`).join('\n\n');
    } else {
      reviewSummary += `Món ăn được đầu bếp chuẩn bị từ nguyên liệu tươi mới mỗi ngày và nhận được phản hồi rất tốt khi phục vụ tại bàn ạ.`;
    }

    return {
      id: msgId,
      role: 'assistant',
      text: reviewSummary,
      intent: 'INTENT_CHECK_REVIEW',
      memory,
      products: [ChatTools.formatProduct(dish)],
      quickReplies: ['Thêm món này vào giỏ', 'Món nào bán chạy nhất?', 'Xem thực đơn'],
    };
  }

  /**
   * Xử lý tư vấn mâm cơm thông minh (Food Recommendation Engine)
   */
  private static async handleFoodRecommendation(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    allergensNotice: string,
    msgId: string
  ): Promise<ChatMessageResponse> {
    const people = memory.numberOfPeople || 2;
    const plans = await ChatTools.buildMealRecommendations(memory);
    memory.lastRecommendations = plans;
    memory.stage = 'RECOMMENDING';

    const plan1 = plans[0];
    const plan2 = plans[1];

    // Kiểm tra lời khuyên thời tiết / hoàn cảnh
    const weatherAdvice = RestaurantKnowledgeBase.getContextualAdvice(cleanNorm);

    let reply = `Dạ, dựa trên nhu cầu của bạn (**${people} người**${memory.budget ? `, ngân sách khoảng ${memory.budget.toLocaleString('vi-VN')}đ` : ''}${memory.spicyPreference === 'NONE' ? ', không cay' : ''}), Hương Sen xin gợi ý 2 phương án thực đơn chuẩn vị:\n\n`;

    if (weatherAdvice) {
      reply = `👉 *${weatherAdvice.advice}*\n\n` + reply;
    }

    reply += `🍱 **${plan1.title}** — **${plan1.subtotal.toLocaleString('vi-VN')}đ**\n`;
    reply += plan1.dishes.map((d) => `  • ${d.name} (${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ)`).join('\n');
    reply += `\n\n🍲 **${plan2.title}** — **${plan2.subtotal.toLocaleString('vi-VN')}đ**\n`;
    reply += plan2.dishes.map((d) => `  • ${d.name} (${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ)`).join('\n');

    reply += `\n\n👉 Bạn ưng ý **Phương án 1** hay **Phương án 2** hơn ạ? Bạn có thể nhắn "Chọn phương án 1/2" hoặc bấm các thẻ món bên dưới để thêm vào giỏ nhé!`;

    if (allergensNotice) {
      reply += `\n\n${allergensNotice}`;
    }

    const allDishes = Array.from(new Set([...plan1.dishes, ...plan2.dishes]));
    memory.lastMentionedProducts = allDishes;

    return {
      id: msgId,
      role: 'assistant',
      text: reply,
      intent: 'INTENT_RECOMMEND_FOOD',
      memory,
      recommendations: plans,
      products: allDishes.slice(0, 4),
      quickReplies: ['Tôi chọn phương án 1', 'Tôi chọn phương án 2', 'Tôi muốn ăn lẩu', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * Xử lý món bán chạy
   */
  private static async handleBestSellers(memory: ConversationMemory, msgId: string): Promise<ChatMessageResponse> {
    const dishes = await ChatTools.searchMenu({
      spicyPreference: memory.spicyPreference,
      allergies: memory.allergies,
      dislikes: memory.dislikes,
      take: 4,
    });

    const textList = dishes.map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ (★ ${d.rating.toFixed(1)})`).join('\n');

    memory.lastMentionedProducts = dishes;

    return {
      id: msgId,
      role: 'assistant',
      text: `Hiện tại các món thuần Việt được gọi nhiều nhất tại Hương Sen${memory.spicyPreference === 'NONE' ? ' (phù hợp với khẩu vị không cay của bạn)' : ''}:\n\n${textList}\n\nBạn có thể bấm trực tiếp vào thẻ món bên dưới để xem chi tiết hoặc thêm vào giỏ nhé!`,
      intent: 'INTENT_CHECK_BEST_SELLER',
      memory,
      products: dishes,
      quickReplies: ['Tư vấn mâm cơm 4 người', 'Có món chay không?', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * Tìm món theo giá
   */
  private static async handlePriceSearch(memory: ConversationMemory, msgId: string): Promise<ChatMessageResponse | null> {
    const max = memory.budget || 150000;
    const dishes = await ChatTools.searchMenu({
      maxPrice: max,
      spicyPreference: memory.spicyPreference,
      allergies: memory.allergies,
      dislikes: memory.dislikes,
      take: 4,
    });

    if (dishes.length === 0) return null;

    memory.lastMentionedProducts = dishes;

    return {
      id: msgId,
      role: 'assistant',
      text: `Dưới đây là một số món ngon mức giá **dưới ${max.toLocaleString('vi-VN')}đ** được yêu thích tại quán:\n\n` +
        dishes.map((d) => `• **${d.name}**: ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ`).join('\n'),
      intent: 'INTENT_CHECK_PRICE',
      memory,
      products: dishes,
      quickReplies: ['Món nào bán chạy?', 'Tư vấn mâm cơm', 'Xem toàn bộ thực đơn'],
    };
  }

  /**
   * Tìm kiếm theo từ khóa
   */
  private static async handleKeywordSearch(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    // Trích xuất từ khóa tìm kiếm (bỏ các từ nối tiếng Việt)
    const stopWords = [
      'co', 'mon', 'khong', 'nha hang co', 'quan co', 'cho toi hoi', 'tim', 'xem', 'cac', 'nhung', 'gi',
      'nao', 'ngon', 'nhat', 'nhe', 'a', 'di', 'cho', 'minh', 'toi', 'em', 'chut', 'vai', 'it'
    ];
    let cleanQuery = cleanNorm;
    for (const w of stopWords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    }

    if (cleanQuery.length < 2) return null;

    // Mapping từ khóa phổ biến sang tên danh mục chính xác trong database
    let categorySearchTerm: string | undefined = undefined;
    if (cleanQuery === 'ga' || cleanQuery.includes('thit ga')) categorySearchTerm = 'Món Gà';
    else if (cleanQuery === 'bo' || cleanQuery.includes('thit bo')) categorySearchTerm = 'Món Bò';
    else if (cleanQuery === 'heo' || cleanQuery === 'lon' || cleanQuery.includes('thit heo')) categorySearchTerm = 'Món Heo';
    else if (cleanQuery === 'hai san' || cleanQuery === 'tom' || cleanQuery === 'muc' || cleanQuery === 'cua') categorySearchTerm = 'Hải Sản';
    else if (cleanQuery === 'com' || cleanQuery === 'com nieu') categorySearchTerm = 'Cơm';
    else if (cleanQuery === 'lau') categorySearchTerm = 'Lẩu';
    else if (cleanQuery === 'canh') categorySearchTerm = 'Canh & Món Nước';
    else if (cleanQuery === 'trang mieng' || cleanQuery === 'che') categorySearchTerm = 'Tráng Miệng';
    else if (cleanQuery === 'nuoc' || cleanQuery === 'do uong' || cleanQuery === 'ca phe' || cleanQuery === 'sinh to') categorySearchTerm = 'Đồ Uống';
    else if (cleanQuery === 'salad' || cleanQuery === 'goi' || cleanQuery === 'nom') categorySearchTerm = 'Gỏi & Nộm';
    else if (cleanQuery === 'chay') categorySearchTerm = 'Món Chay';
    else if (cleanQuery === 'khai vi') categorySearchTerm = 'Khai Vị';
    else if (cleanQuery === 'xao') categorySearchTerm = 'Món Xào';
    else if (cleanQuery === 'kho') categorySearchTerm = 'Món Kho';

    const dishes = await ChatTools.searchMenu({
      query: cleanQuery,
      categoryName: categorySearchTerm,
      spicyPreference: memory.spicyPreference,
      allergies: memory.allergies,
      dislikes: memory.dislikes,
      take: 4,
    });

    if (dishes.length === 0) return null;

    memory.lastMentionedProducts = dishes;

    const displayMap: Record<string, string> = {
      ca: 'món cá',
      ga: 'món gà',
      bo: 'món bò',
      heo: 'món heo',
      lau: 'lẩu',
      tom: 'món tôm',
      muc: 'món mực',
      cua: 'món cua',
      chay: 'món chay',
      com: 'cơm',
      canh: 'canh',
    };
    const displayTerm = categorySearchTerm || displayMap[cleanQuery] || cleanQuery;
    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, Hương Sen có các món **${displayTerm}** tươi ngon, chuẩn vị sau đây dành cho bạn${memory.spicyPreference === 'NONE' ? ' (đã lọc không cay)' : ''}:\n\n` +
        dishes.map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ (★ ${d.rating.toFixed(1)})`).join('\n') +
        `\n\nBạn có thể bấm vào món để xem chi tiết hoặc thêm vào giỏ nhé!`,
      intent: 'INTENT_SEARCH_MENU',
      memory,
      products: dishes,
      quickReplies: ['Tư vấn mâm cơm', 'Tôi muốn đặt bàn', 'Món nào bán chạy?'],
    };
  }

  /**
   * Kiểm tra tình trạng món
   */
  private static async handleAvailabilityCheck(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    let target = context.currentDish?.name;
    if (!target) {
      target = rawMsg
        .replace(/(mon nay|mon do|mon|con khong|het chua|co con|cho toi hoi|co)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!target) return null;

    const dish = await ChatTools.getDishDetails(target);
    if (!dish) return null;

    if (dish.isAvailable) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, món **${dish.name}** hiện **ĐANG CÒN PHỤC VỤ** với giá ${(dish.discountedPrice || dish.price).toLocaleString('vi-VN')}đ.\n\nMón luôn được đầu bếp chế biến nóng sốt từ nguyên liệu tươi trong ngày ạ!`,
        intent: 'INTENT_CHECK_AVAILABILITY',
        memory,
        products: [ChatTools.formatProduct(dish)],
        quickReplies: ['Thêm món này vào giỏ', 'Gợi ý món ăn kèm', 'Xem thực đơn'],
      };
    } else {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ rất tiếc, món **${dish.name}** hôm nay hiện **TẠM HẾT SUẤT** do đã hết nguyên liệu tươi trong ngày. Bạn có thể tham khảo các món đặc sắc khác cùng danh mục ${dish.category?.name || 'món ngon'} nhé!`,
        intent: 'INTENT_CHECK_AVAILABILITY',
        memory,
        products: [ChatTools.formatProduct(dish)],
        quickReplies: ['Món nào được gọi nhiều?', 'Xem thực đơn đầy đủ'],
      };
    }
  }

  /**
   * Xử lý đặt bàn
   */
  private static async handleReservationInquiry(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string
  ): Promise<ChatMessageResponse> {
    const people = memory.numberOfPeople || 2;
    const capacity = await ChatTools.checkReservationCapacity(people);

    let reply = `Dạ, nhà hàng **Hương Sen** rất hân hạnh được đón tiếp bạn! Hiện tại nhà hàng đang có **${capacity.totalAvailable} bàn trống** sẵn sàng đón khách.\n\n`;

    if (memory.numberOfPeople) {
      reply += `Bạn đang muốn đặt bàn cho **${memory.numberOfPeople} người**. Bạn có thể bấm nút **Đặt Bàn Ngay** bên dưới để chọn ngày giờ và không gian ưng ý (Sảnh Mộc, Hiên Sen hoặc Phòng VIP) nhé!`;
    } else {
      reply += `Bạn dự định đi bao nhiêu người và đến vào ngày nào ạ?\n• Đặt trước từ 10 khách được hỗ trợ phòng tiệc VIP riêng\n• Quán giữ bàn trong 15 phút so với giờ hẹn`;
    }

    return {
      id: msgId,
      role: 'assistant',
      text: reply,
      intent: 'INTENT_RESERVATION',
      memory,
      quickReplies: ['Đặt bàn 2 người', 'Đặt bàn 4 người', 'Đặt bàn 6 người', 'Xem thực đơn'],
      action: {
        type: 'open_reserve',
        label: 'Đặt Bàn Ngay',
        payload: memory.numberOfPeople ? `/reserve?guests=${memory.numberOfPeople}` : '/reserve',
      },
    };
  }

  /**
   * Thông tin nhà hàng
   */
  private static handleRestaurantInfo(cleanNorm: string, memory: ConversationMemory, msgId: string): ChatMessageResponse {
    const k = RestaurantKnowledgeBase.getKnowledge();

    if (cleanNorm.includes('mo cua') || cleanNorm.includes('dong cua') || cleanNorm.includes('may gio')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Nhà hàng **${k.name}** mở cửa phục vụ:\n\n• **Giờ mở cửa:** ${k.openingHours}\n• **Bếp nhận order cuối:** ${k.lastOrderTime}\n\nBạn dự định ghé quán vào khung giờ nào hôm nay để mình hỗ trợ giữ chỗ trước ạ?`,
        intent: 'INTENT_RESTAURANT_INFO',
        memory,
        quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Địa chỉ ở đâu?'],
        action: { type: 'open_reserve', payload: '/reserve' },
      };
    }

    if (cleanNorm.includes('dia chi') || cleanNorm.includes('o dau') || cleanNorm.includes('vi tri')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Địa chỉ của **${k.name}** tọa lạc tại:\n📍 **${k.address}**\n\n(${k.parking})`,
        intent: 'INTENT_RESTAURANT_INFO',
        memory,
        quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Giờ mở cửa?'],
      };
    }

    if (cleanNorm.includes('hotline') || cleanNorm.includes('so dien thoai') || cleanNorm.includes('lien he')) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Bạn có thể liên hệ trực tiếp với Hương Sen qua:\n\n📞 **Hotline:** ${k.phone}\n✉️ **Email:** ${k.email}\n📍 **Địa chỉ:** ${k.address}`,
        intent: 'INTENT_RESTAURANT_INFO',
        memory,
        quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn'],
      };
    }

    return {
      id: msgId,
      role: 'assistant',
      text: `**${k.name}** — *"${k.tagline}"*\n📍 ${k.address}\n📞 Hotline: ${k.phone}\n⏰ Giờ phục vụ: ${k.openingHours}\n\nHương Sen có thể hỗ trợ gì thêm cho bạn ạ?`,
      intent: 'INTENT_RESTAURANT_INFO',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn mâm cơm 4 người', 'Đặt bàn ngay'],
    };
  }

  /**
   * Tra cứu đơn hàng
   */
  private static async lookupOrder(query: string, memory: ConversationMemory, msgId: string): Promise<ChatMessageResponse> {
    const cleanQ = query.trim();
    const orders = await prisma.order.findMany({
      where: {
        OR: [{ code: cleanQ }, { customerPhone: cleanQ }],
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        table: true,
        orderItems: { include: { dish: true } },
      },
    });

    if (orders.length === 0) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, Hương Sen không tìm thấy đơn hàng nào khớp với "${cleanQ}".\n\nBạn vui lòng kiểm tra lại chính xác Mã đơn hàng (VD: HS-...) hoặc Số điện thoại đặt món nhé!`,
        intent: 'INTENT_ORDER_LOOKUP',
        memory,
        quickReplies: ['Tra cứu lại', 'Liên hệ hotline', 'Xem thực đơn'],
      };
    }

    const order = orders[0];
    memory.activeOrderCode = order.code;

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

    return {
      id: msgId,
      role: 'assistant',
      text: `Thông tin đơn hàng **#${order.code}**:\n\n` +
        `• **Trạng thái:** ${statusLabels[order.status] || order.status}\n` +
        `• **Số món:** ${order.orderItems.length} món\n` +
        `• **Tổng tiền:** ${order.totalAmount.toLocaleString('vi-VN')}đ\n\n` +
        (order.status === 'preparing'
          ? '👉 Bếp đang chuẩn bị món ăn tươi nóng cho bạn. Tiến trình sẽ được cập nhật tự động ngay trên khung chat này ạ!'
          : ''),
      intent: 'INTENT_ORDER_LOOKUP',
      memory,
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
   * Gọi tính tiền
   */
  private static async handlePaymentRequest(
    context: ChatContext,
    memory: ConversationMemory,
    msgId: string
  ): Promise<ChatMessageResponse> {
    if (context.tableToken) {
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
          intent: 'INTENT_REQUEST_PAYMENT',
          memory,
          quickReplies: ['Cảm ơn nhà hàng', 'Xem thực đơn'],
        };
      }
    }

    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, nếu bạn đang ngồi tại bàn trong nhà hàng, bạn có thể quét mã QR trên bàn để gửi yêu cầu thanh toán tức thì, hoặc báo với bạn nhân viên phục vụ gần nhất để được mang hóa đơn tới bàn nhé!',
      intent: 'INTENT_REQUEST_PAYMENT',
      memory,
      quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Liên hệ hotline'],
    };
  }
}
