import { prisma } from '../../config/prisma.js';
import { broadcastEvent, SocketEvents } from '../../sockets/socket.js';
import {
  ChatIntent,
  StandardChatIntent,
  ChatMessageResponse,
  ChatContext,
  ConversationMemory,
  RecommendationPlan,
  NluResult,
} from './chat.types.js';
import { ChatMemoryManager, normalizeVietnamese } from './chat.memory.js';
import { ChatTools } from './chat.tools.js';
import { RestaurantKnowledgeBase } from './chat.knowledge.js';
import { ChatNLU, NLU_THRESHOLDS } from './chat.nlu.js';

export class ChatService {
  /**
   * Bộ xử lý hội thoại thông minh, hiểu ngữ cảnh và đa lượt (Multi-turn Assistant)
   */
  static async processMessage(message: string, context: ChatContext = {}): Promise<ChatMessageResponse> {
    const rawMsg = (message || '').trim();
    const convId = context.conversationId || 'default-session';
    const msgId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Quản lý Memory & Lịch sử phiên hội thoại
    let memory = ChatMemoryManager.getOrCreateMemory(convId, context.memory);

    // 2. Chạy qua bộ máy NLU toàn diện (Language, Normalization, Entities, Intent Classification)
    const nlu = ChatNLU.process(rawMsg, memory);
    const { primaryIntent, confidence, entities, cleanNorm, normalizedText } = nlu;

    // Cập nhật thực thể vào bộ nhớ phiên
    memory = ChatMemoryManager.extractEntities(rawMsg, memory);
    if (entities.people !== undefined) memory.numberOfPeople = entities.people;
    if (entities.budget !== undefined) memory.budget = entities.budget;
    if (entities.spicyLevel !== undefined) memory.spicyPreference = entities.spicyLevel;
    if (entities.orderCode) memory.activeOrderCode = entities.orderCode;
    ChatMemoryManager.saveMemory(convId, memory);

    // Cảnh báo dị ứng nếu khách có tiền sử
    let allergensNotice = '';
    if (memory.allergies && memory.allergies.length > 0) {
      allergensNotice = `⚠️ **Lưu ý dị ứng (${memory.allergies.join(', ')}):** Nhà hàng sẽ loại trừ các món có thành phần này trong gợi ý. Khi dùng bữa tại quán, bạn vui lòng báo lại với nhân viên phục vụ để bếp dùng bộ dụng cụ riêng biệt nhé!`;
    }

    if (!rawMsg) {
      return this.finalizeResponse(
        {
          id: msgId,
          role: 'assistant',
          text: 'Chào bạn! Hương Sen có thể giúp gì cho bữa ăn của bạn hôm nay ạ?',
          intent: 'GREETING',
          memory,
          quickReplies: ['Xem thực đơn', 'Món nào bán chạy?', 'Tư vấn mâm cơm 4 người', 'Tôi muốn đặt bàn'],
        },
        convId,
        rawMsg
      );
    }

    // 3. BẢO MẬT & GUARDRAIL: Chống Prompt Injection & Gian lận dữ liệu
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
      return this.finalizeResponse(
        {
          id: msgId,
          role: 'assistant',
          text: 'Dạ, mình là nhân viên tư vấn của Nhà hàng Hương Sen, chỉ hỗ trợ quý khách xem thực đơn, tư vấn món ăn, đặt bàn và tra cứu đơn hàng của chính quý khách. Mình không có quyền can thiệp hay chia sẻ dữ liệu nội bộ khác ạ.',
          intent: 'HUMAN_SUPPORT',
          memory,
          quickReplies: ['Xem thực đơn', 'Tư vấn món ngon', 'Đặt bàn ngay'],
        },
        convId,
        rawMsg
      );
    }

    // 4. MULTI-INTENT & INTENT ROUTING
    let response: ChatMessageResponse;

    switch (primaryIntent) {
      case 'GREETING':
        // Nếu câu chào đơn thuần
        if (nlu.intents.length <= 1 || nlu.intents[1].score < 0.6) {
          response = this.handleGreeting(nlu, memory, msgId);
        } else {
          // Multi-intent: Chào kèm câu hỏi hành động (VD: "hello shop, cho mình xem menu", "hi món nào ngon")
          const secondIntent = nlu.intents[1].intent;
          response = await this.routeIntent(secondIntent, rawMsg, cleanNorm, memory, context, msgId, allergensNotice, nlu);
          if (!response.text.toLowerCase().startsWith('chào') && !response.text.toLowerCase().startsWith('dạ, chào')) {
            response.text = `Chào bạn 👋 ${response.text}`;
          }
        }
        break;

      case 'FAREWELL':
        response = this.handleFarewell(memory, msgId);
        break;

      case 'THANKS':
        response = this.handleThanks(memory, msgId);
        break;

      case 'SMALL_TALK':
        response = this.handleSmallTalk(cleanNorm, memory, msgId);
        break;

      case 'JOKE_OR_FUN':
        response = this.handleJoke(cleanNorm, memory, msgId);
        break;

      case 'OUT_OF_SCOPE':
        response = this.handleOutOfScope(memory, msgId);
        break;

      case 'HELP':
        response = this.handleHelp(memory, msgId);
        break;

      case 'VIEW_MENU':
        response = this.handleViewMenu(memory, msgId);
        break;

      case 'SEARCH_MENU':
        response = (await this.handleKeywordSearch(rawMsg, cleanNorm, memory, msgId)) || this.handleFallback(memory, msgId);
        break;

      case 'PRODUCT_PRICE':
        response = await this.handleProductPrice(rawMsg, cleanNorm, memory, context, msgId, nlu);
        break;

      case 'PRODUCT_AVAILABILITY':
        response = await this.handleAvailabilityCheck(rawMsg, cleanNorm, memory, context, msgId, nlu);
        break;

      case 'PRODUCT_SPICY':
        response = await this.handleSpicyCheck(rawMsg, cleanNorm, memory, context, msgId, nlu);
        break;

      case 'PRODUCT_INGREDIENT':
      case 'PRODUCT_DETAIL':
        response = (await this.handleDishExplanation(rawMsg, cleanNorm, memory, context, msgId, nlu)) || (await this.handleKeywordSearch(rawMsg, cleanNorm, memory, msgId)) || this.handleFallback(memory, msgId);
        break;

      case 'PRODUCT_ALLERGEN':
        response = this.handleAllergenCheck(rawMsg, cleanNorm, memory, msgId, nlu);
        break;

      case 'PRODUCT_REVIEW':
        response = (await this.handleReviewInquiry(rawMsg, cleanNorm, memory, context, msgId)) || this.handleFallback(memory, msgId);
        break;

      case 'COMPARE_PRODUCTS':
        response = (await this.handleDishComparison(rawMsg, cleanNorm, memory, msgId)) || this.handleFallback(memory, msgId);
        break;

      case 'BEST_SELLER':
        response = await this.handleBestSellers(memory, msgId);
        break;

      case 'POPULAR_PRODUCTS':
        response = await this.handlePopularProducts(memory, msgId);
        break;

      case 'RECOMMEND_FOOD':
      case 'MEAL_RECOMMENDATION':
        // Kiểm tra xem khách có đang chọn Phương án / Combo cụ thể không
        if (
          entities.referencedPlanIndex ||
          cleanNorm.includes('phuong an 1') ||
          cleanNorm.includes('phuong an 2') ||
          cleanNorm.includes('phuong an 3') ||
          cleanNorm.includes('chon phuong an') ||
          cleanNorm.includes('lay combo')
        ) {
          const planRes = this.handlePlanSelection(cleanNorm, memory, msgId, nlu);
          if (planRes) {
            response = planRes;
            break;
          }
        }
        response = await this.handleFoodRecommendation(rawMsg, cleanNorm, memory, allergensNotice, msgId, nlu);
        break;

      case 'BUDGET_RECOMMENDATION':
        response = (await this.handlePriceSearch(memory, msgId)) || (await this.handleFoodRecommendation(rawMsg, cleanNorm, memory, allergensNotice, msgId, nlu));
        break;

      case 'ADD_TO_CART':
        response = (await this.handleAddToCartRequest(rawMsg, cleanNorm, memory, context, msgId, nlu)) || this.handleFallback(memory, msgId);
        break;

      case 'REMOVE_FROM_CART':
        response = this.handleRemoveFromCart(memory, msgId);
        break;

      case 'VIEW_CART':
        response = this.handleViewCart(memory, msgId);
        break;

      case 'RESERVATION':
      case 'CHECK_RESERVATION':
        response = await this.handleReservationInquiry(rawMsg, cleanNorm, memory, msgId, nlu);
        break;

      case 'CANCEL_RESERVATION':
        response = this.handleCancelReservation(memory, msgId);
        break;

      case 'MY_ORDER':
      case 'ORDER_STATUS':
        const queryParam = entities.orderCode || entities.phone || context.customerPhone || (context.user?.phone ?? null);
        if (queryParam) {
          response = await this.lookupOrder(queryParam, memory, msgId);
        } else {
          response = {
            id: msgId,
            role: 'assistant',
            text: 'Dạ, để kiểm tra tiến trình đơn hàng, bạn vui lòng gửi cho mình **Mã đơn hàng** (VD: `HS-20260928-0001`) hoặc **Số điện thoại** dùng khi đặt món nhé!',
            intent: 'ORDER_STATUS',
            memory,
            quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Liên hệ hotline'],
          };
        }
        break;

      case 'REQUEST_PAYMENT':
      case 'CHECKOUT':
        response = await this.handlePaymentRequest(context, memory, msgId);
        break;

      case 'OPENING_HOURS':
        response = this.handleOpeningHours(memory, msgId);
        break;

      case 'LOCATION':
        response = this.handleLocation(memory, msgId);
        break;

      case 'CONTACT':
        response = this.handleContact(memory, msgId);
        break;

      case 'RESTAURANT_INFO':
        response = this.handleRestaurantInfo(cleanNorm, memory, msgId);
        break;

      case 'PROMOTION':
        response = this.handlePromotion(memory, msgId);
        break;

      case 'COMPLAINT':
      case 'FEEDBACK':
        response = this.handleFeedback(memory, msgId);
        break;

      case 'HUMAN_SUPPORT':
        response = this.handleHumanSupport(memory, msgId);
        break;

      default:
        // Nếu có độ tự tin thấp hoặc không chắc chắn
        response = (await this.handleKeywordSearch(rawMsg, cleanNorm, memory, msgId)) || this.handleFallback(memory, msgId);
        break;
    }

    // Nếu câu ban đầu có chào hỏi mà kết quả chưa có chào, bổ sung cho tự nhiên
    if (nlu.hasGreeting && !response.text.toLowerCase().includes('chào') && primaryIntent !== 'GREETING') {
      response.text = `Chào bạn 👋 ${response.text}`;
    }

    return this.finalizeResponse(response, convId, rawMsg, primaryIntent);
  }

  /**
   * Điều hướng intent phụ khi phát hiện multi-intent
   */
  private static async routeIntent(
    intent: StandardChatIntent,
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string,
    allergensNotice: string,
    nlu: NluResult
  ): Promise<ChatMessageResponse> {
    switch (intent) {
      case 'VIEW_MENU':
        return this.handleViewMenu(memory, msgId);
      case 'BEST_SELLER':
        return await this.handleBestSellers(memory, msgId);
      case 'POPULAR_PRODUCTS':
        return await this.handlePopularProducts(memory, msgId);
      case 'RECOMMEND_FOOD':
      case 'MEAL_RECOMMENDATION':
        return await this.handleFoodRecommendation(rawMsg, cleanNorm, memory, allergensNotice, msgId, nlu);
      case 'RESERVATION':
        return await this.handleReservationInquiry(rawMsg, cleanNorm, memory, msgId, nlu);
      case 'SEARCH_MENU':
        return (await this.handleKeywordSearch(rawMsg, cleanNorm, memory, msgId)) || this.handleFallback(memory, msgId);
      case 'OPENING_HOURS':
        return this.handleOpeningHours(memory, msgId);
      case 'LOCATION':
        return this.handleLocation(memory, msgId);
      default:
        return (await this.handleKeywordSearch(rawMsg, cleanNorm, memory, msgId)) || this.handleFallback(memory, msgId);
    }
  }

  /**
   * Lưu phiên và hoàn tất tin nhắn trả về
   */
  private static finalizeResponse(
    response: ChatMessageResponse,
    convId: string,
    rawMsg: string,
    intent?: ChatIntent
  ): ChatMessageResponse {
    response.memory.lastIntent = (intent as any) || response.intent;
    ChatMemoryManager.recordTurn(convId, rawMsg, response.text, response.intent);
    return response;
  }

  // ==========================================
  // CÁC HÀM XỬ LÝ INTENT CHUYÊN BIỆT
  // ==========================================

  /**
   * 1. GREETING (Chào hỏi)
   */
  private static handleGreeting(nlu: NluResult, memory: ConversationMemory, msgId: string): ChatMessageResponse {
    let text = 'Chào bạn 👋 Hương Sen rất vui được hỗ trợ bạn!';
    if (nlu.detectedLanguage === 'en') {
      text = 'Hello! Welcome to Huong Sen Restaurant 👋 How can I assist you today?';
    } else {
      text += ' Bạn muốn xem thực đơn 118 món, đặt bàn trước hay cần mình tư vấn món ngon cho hôm nay ạ?';
    }

    return {
      id: msgId,
      role: 'assistant',
      text,
      intent: 'GREETING',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn mâm cơm 4 người', 'Món nào bán chạy?', 'Tôi muốn đặt bàn'],
      confidence: nlu.confidence,
    };
  }

  /**
   * 2. FAREWELL (Chào tạm biệt)
   */
  private static handleFarewell(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ tạm biệt bạn! Hương Sen chúc bạn một ngày nhiều niềm vui và rất mong sớm được đón tiếp bạn cùng gia đình tại nhà hàng nhé! 👋',
      intent: 'FAREWELL',
      memory,
      quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 3. THANKS (Cảm ơn)
   */
  private static handleThanks(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ không có chi ạ! 😄 Hương Sen rất hân hạnh được phục vụ bạn. Chúc bạn có một bữa ăn ngon miệng và trọn vẹn nhé! Bạn cần hỗ trợ thêm gì cứ nhắn mình nhé.',
      intent: 'THANKS',
      memory,
      quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Món nào bán chạy?'],
    };
  }

  /**
   * 4. SMALL_TALK (Trò chuyện đời thường)
   */
  private static handleSmallTalk(cleanNorm: string, memory: ConversationMemory, msgId: string): ChatMessageResponse {
    if (cleanNorm.includes('ban la ai') || cleanNorm.includes('ban ten gi') || cleanNorm.includes('ban lam gi')) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, mình là Trợ lý Nhà hàng Hương Sen! Mình có thể giúp bạn xem thực đơn 118 món thuần Việt, gợi ý mâm cơm ấm cúng theo số người & ngân sách, đặt bàn giữ chỗ và tra cứu tiến trình đơn hàng của bạn ạ.',
        intent: 'SMALL_TALK',
        memory,
        quickReplies: ['Xem thực đơn', 'Tư vấn món ngon', 'Tôi muốn đặt bàn'],
      };
    }

    if (cleanNorm === 'ok' || cleanNorm === 'duoc' || cleanNorm === 'duoc roi' || cleanNorm === 'nhat tri') {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ vâng ạ! Bạn có muốn mình hỗ trợ thêm món gì, kiểm tra bàn trống hay thêm vào giỏ hàng luôn không nè?',
        intent: 'SMALL_TALK',
        memory,
        quickReplies: ['Xem giỏ hàng', 'Tôi muốn đặt bàn', 'Món nào bán chạy?'],
      };
    }

    if (cleanNorm.includes('haha') || cleanNorm.includes('hihi') || cleanNorm.includes('tuyet')) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ vâng ạ 😄 Bạn có muốn mình gợi ý thêm món tráng miệng hoặc thức uống thanh mát cho tròn vị bữa ăn không ạ?',
        intent: 'SMALL_TALK',
        memory,
        quickReplies: ['Món tráng miệng', 'Đồ uống giải nhiệt', 'Tôi muốn đặt bàn'],
      };
    }

    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ Hương Sen xin chào bạn! Hôm nay bạn dự định dùng bữa mấy người để mình tư vấn mâm cơm hợp khẩu vị nhất ạ?',
      intent: 'SMALL_TALK',
      memory,
      quickReplies: ['Đi 2 người', 'Đi 4 người / Gia đình', 'Món nào bán chạy?', 'Xem thực đơn'],
    };
  }

  /**
   * 5. JOKE_OR_FUN (Đùa vui / Đói bụng)
   */
  private static handleJoke(cleanNorm: string, memory: ConversationMemory, msgId: string): ChatMessageResponse {
    let text = 'Trời ơi, thực đơn Hương Sen có tới 118 món thuần Việt lận đó 😄 Ăn một bữa hết sao nổi nè! Để mình gợi ý ngay một mâm cơm ấm cúng "cứu đói" tức thì cho bạn nhé?';
    if (cleanNorm.includes('doi')) {
      text = 'Bụng đang cồn cào rồi đúng không nè 😄 Để Hương Sen gợi ý cho bạn vài món nóng sốt, chuẩn bị siêu nhanh để lót dạ ngay nhé!';
    }
    return {
      id: msgId,
      role: 'assistant',
      text,
      intent: 'JOKE_OR_FUN',
      memory,
      quickReplies: ['Mâm cơm 4 người', 'Món nào bán chạy?', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 6. OUT_OF_SCOPE (Ngoài phạm vi nhà hàng)
   */
  private static handleOutOfScope(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, mình là trợ lý ẩm thực của Hương Sen nên chỉ nắm rõ các thông tin về thực đơn 118 món thuần Việt, tư vấn món ăn, đặt bàn và đơn hàng của nhà hàng thôi ạ 😄 Bạn cần mình hỗ trợ phần nào cho bữa ăn hôm nay không nè?',
      intent: 'OUT_OF_SCOPE',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn món ngon', 'Tôi muốn đặt bàn', 'Giờ mở cửa'],
    };
  }

  /**
   * 7. HELP (Hướng dẫn sử dụng)
   */
  private static handleHelp(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, bạn có thể hỏi mình mọi thông tin về Nhà hàng Hương Sen một cách rất tự nhiên:\n\n' +
        '• **Xem thực đơn:** *"Cho xem menu"*, *"Có món gà không?"*, *"Món nào bán chạy?"*\n' +
        '• **Tư vấn mâm cơm:** *"Đi 4 người tầm 500k"*, *"Ăn gì cho 2 người?"*\n' +
        '• **Khẩu vị & Dị ứng:** *"Không ăn cay nha"*, *"Tôi dị ứng đậu phộng"*\n' +
        '• **Chi tiết món:** *"Món đầu tiên giá bao nhiêu?"*, *"Cá kho có cay không?"*\n' +
        '• **Đặt bàn trước:** *"Tối nay 7h còn bàn 4 người không?"*\n' +
        '• **Đơn hàng:** *"Kiểm tra đơn của tôi"*, *"Bếp nấu xong chưa?"*',
      intent: 'HELP',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn mâm cơm 4 người', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 8. VIEW_MENU (Xem toàn bộ thực đơn)
   */
  private static handleViewMenu(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, thực đơn của Nhà hàng Hương Sen gồm **118 món ăn thuần Việt** đặc sắc được chia thành 15 danh mục phong phú: Khai Vị, Món Gà, Món Bò, Món Heo, Cá & Hải Sản, Món Kho, Cơm Niêu, Lẩu Sum Vầy, Món Chay, Tráng Miệng & Thức Uống...\n\nBạn có thể bấm nút **Xem thực đơn** bên dưới hoặc nhắn tên món bạn thích để mình tìm ngay nhé!',
      intent: 'VIEW_MENU',
      memory,
      quickReplies: ['Món nào bán chạy?', 'Tư vấn mâm cơm 4 người', 'Món cá ngon', 'Món chay thanh tịnh'],
      action: { type: 'view_menu', payload: '/menu' },
    };
  }

  /**
   * 9. PRODUCT_PRICE (Hỏi giá món ăn kèm tham chiếu thứ tự / đại từ)
   */
  private static async handleProductPrice(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string,
    nlu: NluResult
  ): Promise<ChatMessageResponse> {
    let targetDish: any = null;

    // Ưu tiên 1: Tham chiếu thứ tự ("món đầu tiên", "món thứ 2", "món cuối")
    if (nlu.entities.referencedProductIndex !== undefined && memory.lastMentionedProducts && memory.lastMentionedProducts.length > 0) {
      const idx = nlu.entities.referencedProductIndex === -1 ? memory.lastMentionedProducts.length - 1 : nlu.entities.referencedProductIndex;
      targetDish = memory.lastMentionedProducts[idx];
    }

    // Ưu tiên 2: Tham chiếu đại từ ("món này", "món đó", "nó")
    if (!targetDish && (nlu.entities.referencedPronoun || cleanNorm.includes('mon nay') || cleanNorm.includes('mon do'))) {
      targetDish = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]) || context.currentDish;
    }

    // Ưu tiên 3: Tên món cụ thể trong câu hỏi
    if (!targetDish) {
      let queryName = rawMsg
        .replace(/(giá|gia|bao nhiêu|bao nhieu|nhiêu|nhieu|tiền|tien|một phần|mot phan|món này|mon nay|món đó|mon do|cho hỏi|cho toi hoi|mon|món|hết)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .trim();
      if (queryName.length >= 2) {
        targetDish = await ChatTools.getDishDetails(queryName);
      }
    }

    // Fallback: lấy món gần nhất trong ngữ cảnh
    if (!targetDish) {
      targetDish = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]);
    }

    if (!targetDish) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, bạn đang muốn hỏi giá của món ăn nào ạ? Bạn có thể nhắn tên món (VD: "Cá lóc nướng trui giá bao nhiêu") hoặc xem bảng giá đầy đủ trong thực đơn nhé!',
        intent: 'PRODUCT_PRICE',
        memory,
        quickReplies: ['Xem thực đơn', 'Món nào bán chạy?'],
      };
    }

    const fullDish = (await ChatTools.getDishDetails(targetDish.id || targetDish.name)) || targetDish;
    const price = fullDish.discountedPrice || fullDish.price;
    memory.lastReferencedProduct = fullDish;

    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, món **${fullDish.name}** hiện có giá là **${price.toLocaleString('vi-VN')}đ/phần** (Khẩu phần: ${fullDish.servingSize || '1 phần'}).\n\n` +
        `• ${fullDish.shortDescription || fullDish.description || 'Món ăn thuần Việt thơm ngon chuẩn vị quê nhà.'}\n` +
        `• Trạng thái: ${fullDish.isAvailable ? '✅ Đang còn phục vụ nóng sốt' : '❌ Tạm hết suất hôm nay'}.`,
      intent: 'PRODUCT_PRICE',
      memory,
      products: [ChatTools.formatProduct(fullDish)],
      quickReplies: ['Còn không?', 'Có cay không?', 'Thêm vào giỏ', 'Gợi ý món ăn kèm'],
      action: {
        type: 'add_to_cart',
        label: 'Thêm vào giỏ',
        payload: { dishes: [ChatTools.formatProduct(fullDish)] },
      },
    };
  }

  /**
   * 10. PRODUCT_AVAILABILITY (Còn hay hết món)
   */
  private static async handleAvailabilityCheck(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string,
    nlu: NluResult
  ): Promise<ChatMessageResponse> {
    let targetDish: any = null;

    // 1. Tham chiếu thứ tự hoặc đại từ
    if (nlu.entities.referencedProductIndex !== undefined && memory.lastMentionedProducts && memory.lastMentionedProducts.length > 0) {
      const idx = nlu.entities.referencedProductIndex === -1 ? memory.lastMentionedProducts.length - 1 : nlu.entities.referencedProductIndex;
      targetDish = memory.lastMentionedProducts[idx];
    } else if (nlu.entities.referencedPronoun || cleanNorm.includes('mon nay') || cleanNorm.includes('mon do') || cleanNorm === 'con khong' || cleanNorm === 'con hok') {
      targetDish = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]) || context.currentDish;
    }

    // 2. Tên món cụ thể
    if (!targetDish) {
      let queryName = rawMsg
        .replace(/(còn không|con khong|còn hok|con hok|hết chưa|het chua|còn món này ko|co con khong|mon nay|mon do|cho toi hoi|mon|món)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .trim();
      if (queryName.length >= 2) {
        targetDish = await ChatTools.getDishDetails(queryName);
      }
    }

    if (!targetDish) {
      targetDish = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]);
    }

    if (!targetDish) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, bạn muốn kiểm tra xem món nào còn phục vụ ạ? Bạn gửi cho mình tên món để mình kiểm tra nguyên liệu bếp ngay nhé!',
        intent: 'PRODUCT_AVAILABILITY',
        memory,
        quickReplies: ['Xem thực đơn', 'Món nào bán chạy?'],
      };
    }

    const fullDish = (await ChatTools.getDishDetails(targetDish.id || targetDish.name)) || targetDish;
    memory.lastReferencedProduct = fullDish;

    if (fullDish.isAvailable) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ có, món **${fullDish.name}** hiện **ĐANG CÒN PHỤC VỤ** với giá ${(fullDish.discountedPrice || fullDish.price).toLocaleString('vi-VN')}đ.\n\nMón luôn được đầu bếp chế biến nóng sốt từ nguyên liệu tươi trong ngày ạ!`,
        intent: 'PRODUCT_AVAILABILITY',
        memory,
        products: [ChatTools.formatProduct(fullDish)],
        quickReplies: ['Thêm món này vào giỏ', 'Món này có cay không?', 'Xem thực đơn'],
        action: {
          type: 'add_to_cart',
          label: 'Thêm vào giỏ',
          payload: { dishes: [ChatTools.formatProduct(fullDish)] },
        },
      };
    } else {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ rất tiếc, món **${fullDish.name}** hôm nay hiện **TẠM HẾT SUẤT** do đã hết nguyên liệu tươi trong ngày. Bạn có thể tham khảo các món đặc sắc khác cùng danh mục ${fullDish.category?.name || 'món ngon'} nhé!`,
        intent: 'PRODUCT_AVAILABILITY',
        memory,
        products: [ChatTools.formatProduct(fullDish)],
        quickReplies: ['Món nào được gọi nhiều?', 'Xem thực đơn đầy đủ'],
      };
    }
  }

  /**
   * 11. PRODUCT_SPICY (Kiểm tra độ cay)
   */
  private static async handleSpicyCheck(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string,
    nlu: NluResult
  ): Promise<ChatMessageResponse> {
    // Nếu khách báo khẩu vị của mình: "tôi không ăn cay", "k cay nha"
    if (cleanNorm === 'toi khong an cay' || cleanNorm === 'khong an cay' || cleanNorm === 'an nhat' || cleanNorm === 'k cay' || cleanNorm === 'ko cay') {
      memory.spicyPreference = 'NONE';
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, mình đã ghi nhớ khẩu vị của bạn là **KHÔNG ĂN CAY**. Từ bây giờ mình sẽ ưu tiên đề xuất các món thanh nhẹ, không ớt cho bạn nhé!\n\nBạn muốn mình gợi ý món cá, gà, cơm niêu hay lẩu không cay ạ?',
        intent: 'PRODUCT_SPICY',
        memory,
        quickReplies: ['Món cá không cay', 'Cơm niêu gia đình', 'Lẩu không cay', 'Món nào bán chạy?'],
      };
    }

    let targetDish: any = null;
    if (nlu.entities.referencedProductIndex !== undefined && memory.lastMentionedProducts && memory.lastMentionedProducts.length > 0) {
      const idx = nlu.entities.referencedProductIndex === -1 ? memory.lastMentionedProducts.length - 1 : nlu.entities.referencedProductIndex;
      targetDish = memory.lastMentionedProducts[idx];
    } else if (nlu.entities.referencedPronoun || cleanNorm.includes('mon nay') || cleanNorm.includes('mon do') || cleanNorm === 'co cay khong') {
      targetDish = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]) || context.currentDish;
    }

    if (!targetDish) {
      let queryName = rawMsg
        .replace(/(có cay không|co cay khong|cay lắm không|cay lam khong|độ cay|do cay|cay không|cay khong|mon nay|mon do|cho toi hoi|mon|món)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .trim();
      if (queryName.length >= 2) {
        targetDish = await ChatTools.getDishDetails(queryName);
      }
    }

    if (!targetDish) {
      targetDish = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]);
    }

    if (!targetDish) {
      return {
        id: msgId,
        role: 'assistant',
        text: 'Dạ, bạn muốn kiểm tra độ cay của món nào ạ? Đa phần các món tại Hương Sen đều có thể điều chỉnh độ cay theo yêu cầu khi bạn gọi món nhé!',
        intent: 'PRODUCT_SPICY',
        memory,
        quickReplies: ['Xem thực đơn', 'Gợi ý món không cay'],
      };
    }

    const fullDish = (await ChatTools.getDishDetails(targetDish.id || targetDish.name)) || targetDish;
    memory.lastReferencedProduct = fullDish;

    let spicyDesc = '';
    if (fullDish.spicyLevel === 'NONE') {
      spicyDesc = `món **${fullDish.name}** **HOÀN TOÀN KHÔNG CAY** ạ. Món có vị ngọt thanh tự nhiên, cả người lớn và trẻ nhỏ đều dùng rất ngon miệng.`;
    } else if (fullDish.spicyLevel === 'MILD') {
      spicyDesc = `món **${fullDish.name}** chỉ **CAY NHẸ THƠM TIÊU**, không nồng gắt, rất dậy vị và dễ ăn ạ.`;
    } else {
      spicyDesc = `món **${fullDish.name}** có vị **CAY VỪA ĐẬM ĐÀ** từ ớt xiêm và tiêu sọ. Nếu bạn ăn ít cay, khi gọi món bạn có thể nhắn bếp giảm bớt ớt nhé!`;
    }

    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, ${spicyDesc}`,
      intent: 'PRODUCT_SPICY',
      memory,
      products: [ChatTools.formatProduct(fullDish)],
      quickReplies: ['Thêm món này vào giỏ', 'Gợi ý món không cay', 'Xem thực đơn'],
    };
  }

  /**
   * 12. PRODUCT_INGREDIENT & PRODUCT_DETAIL (Giải thích món ăn & nguyên liệu)
   */
  private static async handleDishExplanation(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string,
    nlu: NluResult
  ): Promise<ChatMessageResponse | null> {
    let target: any = null;

    if (nlu.entities.referencedProductIndex !== undefined && memory.lastMentionedProducts && memory.lastMentionedProducts.length > 0) {
      const idx = nlu.entities.referencedProductIndex === -1 ? memory.lastMentionedProducts.length - 1 : nlu.entities.referencedProductIndex;
      target = memory.lastMentionedProducts[idx];
    } else if (nlu.entities.referencedPronoun || cleanNorm.includes('mon nay') || cleanNorm.includes('mon do')) {
      target = memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]) || context.currentDish;
    }

    if (!target) {
      let queryName = rawMsg
        .replace(/(la mon gi|nguyen lieu|thanh phan|nau tu gi|co nhung gi|mon nay|mon do|cho toi hoi|la gi|co|gi|mon)/gi, ' ')
        .replace(/(là món gì|nguyên liệu|thành phần|nấu từ gì|có những gì|món này|món đó|cho tôi hỏi|là gì|có|gì|món)/gi, ' ')
        .replace(/[?!.,;:()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (queryName.length >= 2) {
        target = await ChatTools.getDishDetails(queryName);
      }
    }

    if (!target) return null;

    const dish = (await ChatTools.getDishDetails(target.id || target.name)) || target;
    if (!dish) return null;
    memory.lastReferencedProduct = dish;

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
      intent: 'PRODUCT_INGREDIENT',
      memory,
      products: [ChatTools.formatProduct(dish)],
      quickReplies: ['Món này có cay không?', 'Thêm vào giỏ', 'Gợi ý món ăn kèm'],
    };
  }

  /**
   * 13. PRODUCT_ALLERGEN (Ghi nhận dị ứng)
   */
  private static handleAllergenCheck(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string,
    nlu: NluResult
  ): ChatMessageResponse {
    const list = memory.allergies.join(', ') || 'thực phẩm';
    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, mình đã ghi nhận thông tin bạn **dị ứng ${list}** và sẽ loại trừ các món có thành phần này trong danh sách gợi ý.\n\n⚠️ **Lưu ý an toàn:** Để loại trừ hoàn toàn nguy cơ nhiễm chéo trong gian bếp, bạn vui lòng nhắc lại với bạn nhân viên phục vụ khi đến quán để bếp dùng dụng cụ riêng nhé! Bạn muốn mình gợi ý món khai vị hay món chính nào ạ?`,
      intent: 'PRODUCT_ALLERGEN',
      memory,
      quickReplies: ['Gợi ý món khai vị', 'Món cá kho', 'Cơm niêu gia đình'],
    };
  }

  /**
   * 14. PRODUCT_REVIEW (Đánh giá thực tế của món)
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
    if (!target) {
      target = memory.lastReferencedProduct?.name || memory.lastMentionedProducts?.[0]?.name;
    }
    if (!target) return null;

    const dish = await ChatTools.getDishDetails(target);
    if (!dish) return null;
    memory.lastReferencedProduct = dish;

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
      intent: 'PRODUCT_REVIEW',
      memory,
      products: [ChatTools.formatProduct(dish)],
      quickReplies: ['Thêm món này vào giỏ', 'Món nào bán chạy nhất?', 'Xem thực đơn'],
    };
  }

  /**
   * 15. COMPARE_PRODUCTS (So sánh 2 món ăn)
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
        intent: 'COMPARE_PRODUCTS',
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
        ? 'Cả hai món có mức giá tương đương. Nếu bạn thích vị đậm đà ăn cơm nóng thì chọn món kho, còn thích thanh mát thì chọn món canh nhé!'
        : `Món ${dishA.price > dishB.price ? dishA.name : dishB.name} chênh lệch khoảng ${priceDiff.toLocaleString('vi-VN')}đ, khẩu phần và nguyên liệu rất phong phú.`);

    return {
      id: msgId,
      role: 'assistant',
      text: comparisonText,
      intent: 'COMPARE_PRODUCTS',
      memory,
      products: [ChatTools.formatProduct(dishA as any), ChatTools.formatProduct(dishB as any)],
      quickReplies: [`Thêm ${dishA.name} vào giỏ`, `Thêm ${dishB.name} vào giỏ`, 'Xem thực đơn'],
    };
  }

  /**
   * 16. BEST_SELLER (Món bán chạy)
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
      intent: 'BEST_SELLER',
      memory,
      products: dishes,
      quickReplies: ['Tư vấn mâm cơm 4 người', 'Có món chay không?', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 17. POPULAR_PRODUCTS (Món đặc sắc)
   */
  private static async handlePopularProducts(memory: ConversationMemory, msgId: string): Promise<ChatMessageResponse> {
    const dishes = await ChatTools.searchMenu({
      spicyPreference: memory.spicyPreference,
      allergies: memory.allergies,
      take: 4,
    });
    memory.lastMentionedProducts = dishes;

    return {
      id: msgId,
      role: 'assistant',
      text: `Các món đặc sắc chuẩn vị quê nhà được yêu thích tại Hương Sen:\n\n` +
        dishes.map((d) => `• **${d.name}** — ${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ`).join('\n') +
        `\n\nBạn bấm vào món để xem chi tiết hoặc thêm vào giỏ nhé!`,
      intent: 'POPULAR_PRODUCTS',
      memory,
      products: dishes,
      quickReplies: ['Xem thực đơn', 'Tư vấn mâm cơm 4 người'],
    };
  }

  /**
   * 18. MEAL_RECOMMENDATION & RECOMMEND_FOOD (Tư vấn mâm cơm theo số người / ngân sách)
   */
  private static async handleFoodRecommendation(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    allergensNotice: string,
    msgId: string,
    nlu?: NluResult
  ): Promise<ChatMessageResponse> {
    // Nếu khách báo số người nhưng chưa có ngân sách và chưa có sở thích
    if (
      memory.numberOfPeople &&
      !memory.budget &&
      (cleanNorm.match(/^(\d+|hai|ba|bon|nam|sau)\s*(nguoi|khach|ng)$/) || cleanNorm.startsWith('toi di') || cleanNorm.startsWith('tui di'))
    ) {
      return {
        id: msgId,
        role: 'assistant',
        text: `Dạ, bạn muốn mình tư vấn món cho **${memory.numberOfPeople} người** nhé! Bạn dự định ngân sách khoảng bao nhiêu (VD: 500k–700k) và thích dùng cơm gia đình ấm cúng, món nướng hay lẩu sum vầy ạ?`,
        intent: 'RECOMMEND_FOOD',
        memory,
        quickReplies: ['Khoảng 500k', 'Khoảng 700k', 'Món Việt truyền thống', 'Tôi muốn ăn lẩu'],
      };
    }

    const people = memory.numberOfPeople || 2;
    const plans = await ChatTools.buildMealRecommendations(memory);
    memory.lastRecommendations = plans;
    memory.stage = 'RECOMMENDING';

    const plan1 = plans[0];
    const plan2 = plans[1];

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
      intent: 'RECOMMEND_FOOD',
      memory,
      recommendations: plans,
      products: allDishes.slice(0, 4),
      quickReplies: ['Tôi chọn phương án 1', 'Tôi chọn phương án 2', 'Tôi muốn ăn lẩu', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 19. CHỌN PHƯƠNG ÁN / COMBO
   */
  private static handlePlanSelection(
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string,
    nlu?: NluResult
  ): ChatMessageResponse | null {
    if (!memory.lastRecommendations || memory.lastRecommendations.length === 0) return null;

    let selectedPlan: RecommendationPlan | undefined;
    const planIndex = nlu?.entities?.referencedPlanIndex;

    if (planIndex === 1 || cleanNorm.includes('phuong an 1') || cleanNorm.includes('combo 1')) selectedPlan = memory.lastRecommendations.find((p) => p.planId === 1);
    else if (planIndex === 2 || cleanNorm.includes('phuong an 2') || cleanNorm.includes('combo 2')) selectedPlan = memory.lastRecommendations.find((p) => p.planId === 2);
    else if (planIndex === 3 || cleanNorm.includes('phuong an 3') || cleanNorm.includes('combo 3')) selectedPlan = memory.lastRecommendations.find((p) => p.planId === 3);

    if (!selectedPlan) return null;

    const dishList = selectedPlan.dishes.map((d) => `• **${d.name}** (${(d.discountedPrice || d.price).toLocaleString('vi-VN')}đ)`).join('\n');

    return {
      id: msgId,
      role: 'assistant',
      text: `Tuyệt vời ạ! Bạn đã chọn **${selectedPlan.title}** với tổng tiền **${selectedPlan.subtotal.toLocaleString('vi-VN')}đ** gồm:\n\n${dishList}\n\n👉 Bạn có muốn mình **Thêm tất cả các món này vào giỏ hàng** luôn không ạ?`,
      intent: 'MEAL_RECOMMENDATION',
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
   * 20. BUDGET_RECOMMENDATION (Tìm món theo mức giá)
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
      intent: 'BUDGET_RECOMMENDATION',
      memory,
      products: dishes,
      quickReplies: ['Món nào bán chạy?', 'Tư vấn mâm cơm', 'Xem toàn bộ thực đơn'],
    };
  }

  /**
   * 21. SEARCH_MENU (Tìm kiếm món ăn / danh mục)
   */
  private static async handleKeywordSearch(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string
  ): Promise<ChatMessageResponse | null> {
    const stopWords = [
      'co', 'mon', 'khong', 'nha hang co', 'quan co', 'cho toi hoi', 'tim', 'xem', 'cac', 'nhung', 'gi',
      'nao', 'ngon', 'nhat', 'nhe', 'a', 'di', 'cho', 'minh', 'toi', 'em', 'chut', 'vai', 'it'
    ];
    let cleanQuery = cleanNorm;
    for (const w of stopWords) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    }

    if (cleanQuery.length < 2) return null;

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
      intent: 'SEARCH_MENU',
      memory,
      products: dishes,
      quickReplies: ['Tư vấn mâm cơm', 'Tôi muốn đặt bàn', 'Món nào bán chạy?'],
    };
  }

  /**
   * 22. ADD_TO_CART (Thêm món vào giỏ hàng từ chat)
   */
  private static async handleAddToCartRequest(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    context: ChatContext,
    msgId: string,
    nlu?: NluResult
  ): Promise<ChatMessageResponse | null> {
    // 1. Thêm theo phương án / combo
    if (cleanNorm.includes('phuong an') || cleanNorm.includes('combo')) {
      const matchPlan = cleanNorm.match(/phuong an\s*(\d)/) || cleanNorm.match(/combo\s*(\d)/);
      const planId = matchPlan ? parseInt(matchPlan[1]) : 1;
      const targetPlan = memory.lastRecommendations?.find((p) => p.planId === planId);
      if (targetPlan) {
        return {
          id: msgId,
          role: 'assistant',
          text: `Dạ, mình đã chuẩn bị các món trong **${targetPlan.title}** (${targetPlan.dishes.length} món - ${targetPlan.subtotal.toLocaleString('vi-VN')}đ). Bạn bấm nút **Xác nhận thêm vào giỏ** bên dưới để đưa vào giỏ hàng nhé!`,
          intent: 'ADD_TO_CART',
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

    // 2. Thêm món vừa thảo luận
    const targetDish = context.currentDish || memory.lastReferencedProduct || (memory.lastMentionedProducts && memory.lastMentionedProducts[0]);
    if (targetDish) {
      const fullDish = (await ChatTools.getDishDetails(targetDish.id || targetDish.name)) || targetDish;
      if (fullDish) {
        return {
          id: msgId,
          role: 'assistant',
          text: `Dạ, bạn bấm nút **Thêm vào giỏ** bên dưới để đưa **${fullDish.name}** (${(fullDish.discountedPrice || fullDish.price).toLocaleString('vi-VN')}đ) vào giỏ hàng ngay nhé!`,
          intent: 'ADD_TO_CART',
          memory,
          products: [ChatTools.formatProduct(fullDish)],
          quickReplies: ['Xem giỏ hàng', 'Gợi ý món ăn kèm', 'Tôi muốn đặt bàn'],
          action: {
            type: 'add_to_cart',
            label: 'Thêm vào giỏ',
            payload: { dishes: [ChatTools.formatProduct(fullDish)] },
          },
        };
      }
    }

    return null;
  }

  /**
   * 23. REMOVE_FROM_CART (Bỏ món khỏi giỏ)
   */
  private static handleRemoveFromCart(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, để bỏ bớt món hoặc giảm số lượng, bạn chỉ cần bấm vào biểu tượng Giỏ Hàng ở góc trên màn hình và bấm nút dấu trừ hoặc biểu tượng thùng rác bên cạnh món nhé!',
      intent: 'REMOVE_FROM_CART',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn món khác'],
    };
  }

  /**
   * 24. VIEW_CART (Xem giỏ hàng)
   */
  private static handleViewCart(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, bạn có thể bấm vào biểu tượng Giỏ Hàng ở góc trên màn hình để kiểm tra danh sách món đã chọn và tiến hành đặt món nhé!',
      intent: 'VIEW_CART',
      memory,
      quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn'],
    };
  }

  /**
   * 25. RESERVATION (Đặt bàn & Kiểm tra chỗ)
   */
  private static async handleReservationInquiry(
    rawMsg: string,
    cleanNorm: string,
    memory: ConversationMemory,
    msgId: string,
    nlu: NluResult
  ): Promise<ChatMessageResponse> {
    const people = memory.numberOfPeople || nlu.entities.people || 2;
    const capacity = await ChatTools.checkReservationCapacity(people);

    let reply = `Dạ, nhà hàng **Hương Sen** rất hân hạnh được đón tiếp bạn! Hiện tại nhà hàng đang có **${capacity.totalAvailable} bàn trống** sẵn sàng phục vụ.\n\n`;

    if (memory.numberOfPeople) {
      reply += `Bạn đang muốn đặt bàn cho **${memory.numberOfPeople} người**${nlu.entities.date ? ` vào **${nlu.entities.date}**` : ''}${nlu.entities.time ? ` lúc **${nlu.entities.time}**` : ''}.\n\n` +
        `Bạn có thể bấm nút **Đặt Bàn Ngay** bên dưới để xác nhận giữ chỗ (Sảnh Mộc, Hiên Sen hoặc Phòng VIP) nhé! Quán sẽ giữ bàn cho bạn trong 15 phút so với giờ hẹn ạ.`;
    } else {
      reply += `Bạn dự định đi bao nhiêu người và đến vào ngày nào ạ?\n• Đặt trước từ 10 khách được hỗ trợ phòng tiệc VIP riêng\n• Quán giữ bàn trong 15 phút so với giờ hẹn`;
    }

    return {
      id: msgId,
      role: 'assistant',
      text: reply,
      intent: 'RESERVATION',
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
   * 26. CANCEL_RESERVATION (Hủy bàn)
   */
  private static handleCancelReservation(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, để hủy hoặc thay đổi giờ đặt bàn, bạn vui lòng gọi trực tiếp hotline **0901.234.567** đọc số điện thoại đặt bàn để nhân viên lễ tân hỗ trợ điều chỉnh trên hệ thống ngay cho bạn nhé!',
      intent: 'CANCEL_RESERVATION',
      memory,
      quickReplies: ['Liên hệ hotline', 'Đặt bàn khác', 'Xem thực đơn'],
    };
  }

  /**
   * 27. OPENING_HOURS (Giờ mở cửa)
   */
  private static handleOpeningHours(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    const k = RestaurantKnowledgeBase.getKnowledge();
    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, Nhà hàng **${k.name}** mở cửa phục vụ từ **10:00 sáng đến 22:30 tối** tất cả các ngày trong tuần (kể cả Thứ Bảy, Chủ Nhật và ngày Lễ Tết) ạ.\n\n` +
        `• **Bếp nhận order cuối cùng:** vào lúc **${k.lastOrderTime}** để đảm bảo món ăn được nấu nóng sốt và trọn vẹn nhất.\n` +
        `• Bạn dự định ghé quán vào khung giờ nào để mình hỗ trợ giữ chỗ trước ạ?`,
      intent: 'OPENING_HOURS',
      memory,
      quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Địa chỉ ở đâu?'],
      action: { type: 'open_reserve', payload: '/reserve' },
    };
  }

  /**
   * 28. LOCATION (Địa chỉ nhà hàng)
   */
  private static handleLocation(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    const k = RestaurantKnowledgeBase.getKnowledge();
    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, Nhà hàng **${k.name}** tọa lạc tại địa chỉ:\n\n` +
        `📍 **${k.address}**\n\n` +
        `• Nhà hàng có bãi đậu xe ô tô và xe máy rộng rãi, an toàn, có bảo vệ trông xe miễn phí ạ.\n` +
        `• Hotline hướng dẫn đường: **${k.phone}**.`,
      intent: 'LOCATION',
      memory,
      quickReplies: ['Tôi muốn đặt bàn', 'Giờ mở cửa', 'Xem thực đơn'],
    };
  }

  /**
   * 29. CONTACT (Liên hệ & Hotline)
   */
  private static handleContact(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    const k = RestaurantKnowledgeBase.getKnowledge();
    return {
      id: msgId,
      role: 'assistant',
      text: `Dạ, bạn có thể liên hệ trực tiếp với Hương Sen qua các kênh sau ạ:\n\n` +
        `📞 **Hotline / Zalo hỗ trợ:** **${k.phone}** (10:00 - 22:30)\n` +
        `📧 **Email:** \`${k.email}\`\n` +
        `📍 **Địa chỉ:** ${k.address}\n\n` +
        `Bạn cần hỗ trợ đặt tiệc, đặt phòng VIP hay hỏi thăm đơn hàng thì cứ nhắn mình hoặc gọi hotline nhé!`,
      intent: 'CONTACT',
      memory,
      quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn', 'Kiểm tra đơn hàng'],
    };
  }

  /**
   * 30. RESTAURANT_INFO (Thông tin chung nhà hàng)
   */
  private static handleRestaurantInfo(cleanNorm: string, memory: ConversationMemory, msgId: string): ChatMessageResponse {
    const k = RestaurantKnowledgeBase.getKnowledge();
    return {
      id: msgId,
      role: 'assistant',
      text: `**${k.name}** — *"${k.tagline}"*\n📍 ${k.address}\n📞 Hotline: ${k.phone}\n⏰ Giờ phục vụ: ${k.openingHours}\n\nHương Sen có thể hỗ trợ gì thêm cho bữa ăn của bạn hôm nay ạ?`,
      intent: 'RESTAURANT_INFO',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn mâm cơm 4 người', 'Đặt bàn ngay'],
    };
  }

  /**
   * 31. PROMOTION (Ưu đãi & Khuyến mãi)
   */
  private static handlePromotion(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, hiện tại Nhà hàng Hương Sen đang có các chương trình ưu đãi đặc sắc dành cho thực khách:\n\n' +
        '• **Giảm 10%** tổng hóa đơn khi đặt bàn trước qua website\n' +
        '• **Tặng món tráng miệng chè sen long nhãn** cho bàn từ 4 khách trở lên\n' +
        '• **Hỗ trợ miễn phí phòng tiệc VIP riêng** cho đoàn từ 10 khách trở lên\n\n' +
        'Bạn có muốn mình hỗ trợ đặt bàn giữ chỗ ngay để nhận ưu đãi không ạ?',
      intent: 'PROMOTION',
      memory,
      quickReplies: ['Đặt bàn ngay', 'Xem thực đơn', 'Món nào bán chạy?'],
      action: { type: 'open_reserve', payload: '/reserve' },
    };
  }

  /**
   * 32. FEEDBACK & COMPLAINT (Ý kiến đóng góp & Phản hồi)
   */
  private static handleFeedback(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, Hương Sen vô cùng trân trọng mọi ý kiến đóng góp từ quý thực khách để ngày một hoàn thiện hơn! Bạn có thể chia sẻ chi tiết vấn đề bạn gặp phải tại đây, hoặc gọi trực tiếp hotline quản lý **0901.234.567** để quán lắng nghe và xử lý ngay lập tức nhé!',
      intent: 'FEEDBACK',
      memory,
      quickReplies: ['Liên hệ hotline', 'Xem thực đơn'],
    };
  }

  /**
   * 33. HUMAN_SUPPORT (Gặp nhân viên / Quản lý)
   */
  private static handleHumanSupport(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, nếu bạn cần trao đổi trực tiếp với nhân viên quản lý nhà hàng để đặt tiệc riêng hoặc yêu cầu đặc biệt, bạn có thể gọi hotline:\n\n📞 **Hotline quản lý:** **0901.234.567** (Phục vụ 10:00 - 22:30)\n\nNhân viên nhà hàng luôn sẵn sàng hỗ trợ bạn nhanh nhất ạ!',
      intent: 'HUMAN_SUPPORT',
      memory,
      quickReplies: ['Tôi muốn đặt bàn', 'Xem thực đơn'],
    };
  }

  /**
   * 34. ORDER_STATUS (Tra cứu đơn hàng)
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
        intent: 'ORDER_STATUS',
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
      intent: 'ORDER_STATUS',
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
   * 35. REQUEST_PAYMENT (Thanh toán tại bàn)
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
          intent: 'REQUEST_PAYMENT',
          memory,
          quickReplies: ['Cảm ơn nhà hàng', 'Xem thực đơn'],
        };
      }
    }

    return {
      id: msgId,
      role: 'assistant',
      text: 'Dạ, nếu bạn đang ngồi tại bàn trong nhà hàng, bạn có thể quét mã QR trên bàn để gửi yêu cầu thanh toán tức thì, hoặc báo với bạn nhân viên phục vụ gần nhất để được mang hóa đơn tới bàn nhé!',
      intent: 'REQUEST_PAYMENT',
      memory,
      quickReplies: ['Xem thực đơn', 'Tôi muốn đặt bàn', 'Liên hệ hotline'],
    };
  }

  /**
   * 36. FALLBACK TỰ NHIÊN (Khi không xác định được intent)
   */
  private static handleFallback(memory: ConversationMemory, msgId: string): ChatMessageResponse {
    return {
      id: msgId,
      role: 'assistant',
      text: 'Mình chưa hiểu ý bạn lắm 😄 Bạn đang muốn hỏi về thực đơn món ăn, tư vấn chọn món, đặt bàn hay kiểm tra đơn hàng ạ?',
      intent: 'UNKNOWN',
      memory,
      quickReplies: ['Xem thực đơn', 'Tư vấn món ngon', 'Tôi muốn đặt bàn', 'Kiểm tra đơn hàng', 'Giờ mở cửa'],
      action: { type: 'view_menu', payload: '/menu' },
    };
  }
}
