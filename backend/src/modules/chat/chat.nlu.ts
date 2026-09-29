/**
 * BỘ MÁY HIỂU NGÔN NGỮ TỰ NHIÊN (NATURAL LANGUAGE UNDERSTANDING - NLU)
 * DÀNH RIÊNG CHO NHÀ HÀNG HƯƠNG SEN
 */

import {
  StandardChatIntent,
  IntentMatch,
  NluEntities,
  NluResult,
  ConversationMemory,
} from './chat.types.js';

export const NLU_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.35,
};

export class ChatNLU {
  /**
   * 1. Chuẩn hóa tiếng Việt có dấu sang không dấu (lowercase, bỏ dấu thanh)
   */
  static normalizeVietnamese(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .trim();
  }

  /**
   * 2. Bóc tách Emoji từ câu
   */
  static extractEmojis(text: string): string[] {
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }

  /**
   * 3. Giảm bớt các ký tự bị kéo dài (Vowel & Consonant Stretching)
   */
  static reduceStretching(text: string): string {
    if (!text) return '';
    let cleaned = text.replace(/([a-zA-Z\u00C0-\u024F\u1EA0-\u1EF9])\1{2,}/gi, '$1');
    cleaned = cleaned.replace(/([nNpPsSdDtTgG])\1\b/gi, '$1');
    return cleaned;
  }

  /**
   * Helper thay thế từ độc lập không dùng \b ASCII (tránh nhầm với nguyên âm tiếng Việt)
   */
  private static replaceWholeWord(text: string, word: string, replacement: string): string {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[\\s,?!.;:()/"'“”])${escaped}(?=$|[\\s,?!.;:()/"'“”])`, 'gi');
    return text.replace(regex, `$1${replacement}`);
  }

  /**
   * 4. Nhận diện ngôn ngữ (Tiếng Việt, Tiếng Anh, hoặc trộn lẫn)
   */
  static detectLanguage(rawText: string, normText: string): 'vi' | 'en' | 'mixed' {
    const englishWords = [
      'hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon',
      'menu', 'please', 'what', 'recommend', 'popular', 'best seller',
      'how much', 'price', 'book', 'table', 'reservation', 'cancel',
      'where', 'opening hours', 'contact', 'order', 'status', 'check'
    ];

    const vietnameseMarkers = [
      'ạ', 'ơi', 'nhé', 'nha', 'mình', 'tôi', 'bạn', 'quán', 'nhà hàng',
      'cho', 'xem', 'thực đơn', 'món', 'ăn', 'gì', 'đặt bàn', 'không', 'được',
      'cơm', 'cá', 'gà', 'bò', 'lẩu', 'người', 'tiền', 'nghìn', 'triệu'
    ];

    let hasEnglish = false;
    let hasVietnamese = false;

    const lowerRaw = rawText.toLowerCase();
    const lowerNorm = normText.toLowerCase();

    for (const en of englishWords) {
      const reg = new RegExp(`(^|[\\s,?!.;:()/"'“”])${en}(?=$|[\\s,?!.;:()/"'“”])`, 'i');
      if (reg.test(lowerRaw) || reg.test(lowerNorm)) {
        hasEnglish = true;
        break;
      }
    }

    if (/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(rawText)) {
      hasVietnamese = true;
    } else {
      for (const vi of vietnameseMarkers) {
        const reg = new RegExp(`(^|[\\s,?!.;:()/"'“”])${vi}(?=$|[\\s,?!.;:()/"'“”])`, 'i');
        if (reg.test(lowerNorm)) {
          hasVietnamese = true;
          break;
        }
      }
    }

    if (hasEnglish && hasVietnamese) return 'mixed';
    if (hasEnglish && !hasVietnamese) return 'en';
    return 'vi';
  }

  /**
   * 5. Chuẩn hóa lỗi chính tả, từ viết tắt và tiếng lóng (Slang & Teencode)
   */
  static normalizeSlangAndSpelling(rawText: string): { normalized: string; cleanNorm: string } {
    let text = rawText.toLowerCase().trim();
    text = this.reduceStretching(text);

    // Chuẩn hóa 'bn' theo ngữ cảnh:
    text = text.replace(/(giá|gia|hết|het|tổng|tong|tầm|tam|khoảng|khoang)\s+bn(?=$|[\s,?!.;:()/"'“”])/gi, '$1 bao nhiêu');
    text = text.replace(/(^|[\s,?!.;:()/"'“”])bn\s+(tiền|tien|k|đồng|dong|vnd)/gi, '$1bao nhiêu $2');
    text = this.replaceWholeWord(text, 'bn', 'bạn');

    // Chuẩn hóa 'm' theo ngữ cảnh
    text = text.replace(/(^|[\s,?!.;:()/"'“”])m\s+(đi|di|ăn|an|chọn|chon|thích|thich|muốn|muon)/gi, '$1mình $2');

    // Các từ ngữ lóng / viết tắt an toàn
    const wholeWordSlang: Array<[string, string]> = [
      ['helo', 'hello'],
      ['helooo', 'hello'],
      ['hellooo', 'hello'],
      ['hii', 'hi'],
      ['hiii', 'hi'],
      ['ko', 'không'],
      ['k', 'không'],
      ['hok', 'không'],
      ['hong', 'không'],
      ['hem', 'không'],
      ['kh', 'không'],
      ['dc', 'được'],
      ['đc', 'được'],
      ['mk', 'mình'],
      ['tui', 'tôi'],
      ['nv', 'nhân viên'],
      ['ib', 'nhắn tin'],
      ['rep', 'trả lời'],
      ['mn', 'mọi người'],
      ['vs', 'với'],
      ['j', 'gì'],
      ['z', 'gì'],
      ['thui', 'thôi'],
      ['vô', 'vào'],
      ['ngonn', 'ngon'],
      ['đơnn', 'đơn'],
      ['dc ko', 'được không'],
      ['dc k', 'được không'],
      ['duoc ko', 'được không'],
      ['duoc k', 'được không'],
      ['con hok', 'còn không'],
      ['con ko', 'còn không'],
      ['con k', 'còn không'],
      ['co k', 'có không'],
      ['co ko', 'có không'],
      ['co hok', 'có không'],
      ['k cay', 'không cay'],
      ['ko cay', 'không cay'],
      ['k co cay', 'không cay'],
      ['book bàn', 'đặt bàn'],
      ['book ban', 'đặt bàn'],
      ['book table', 'đặt bàn'],
      ['book a table', 'đặt bàn'],
    ];

    for (const [w, r] of wholeWordSlang) {
      text = this.replaceWholeWord(text, w, r);
    }

    text = text.replace(/\s+/g, ' ').trim();

    const norm = this.normalizeVietnamese(text);
    const cleanNorm = norm.replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();

    return { normalized: text, cleanNorm };
  }

  /**
   * 6. Trích xuất thực thể (Entity Extraction)
   */
  static extractEntities(rawText: string, cleanNorm: string, memory?: ConversationMemory): NluEntities {
    const entities: NluEntities = {};

    // 6.1 Số người (People Count)
    const numPeopleMatch = cleanNorm.match(/(?:^|\s)(\d+)\s*(?:nguoi|ng|khach|pax|p|suat|phan|ban)(?:\s|$)/i);
    if (numPeopleMatch) {
      const p = parseInt(numPeopleMatch[1]);
      if (p > 0 && p <= 100) entities.people = p;
    } else {
      const groupMatch = cleanNorm.match(/(?:nhom|team|di)\s*(\d+)/i);
      if (groupMatch) {
        const p = parseInt(groupMatch[1]);
        if (p > 0 && p <= 100) entities.people = p;
      }
    }

    if (!entities.people) {
      const wordNumbers: Record<string, number> = {
        'mot': 1,
        'hai': 2,
        'di doi': 2,
        '2 vo chong': 2,
        'ba': 3,
        'bon': 4,
        'nam': 5,
        'sau': 6,
        'bay': 7,
        'tam': 8,
        'chin': 9,
        'muoi': 10,
      };
      for (const [word, val] of Object.entries(wordNumbers)) {
        if (
          cleanNorm.includes(`${word} nguoi`) ||
          cleanNorm.includes(`${word} khach`) ||
          cleanNorm.includes(`${word} ng`) ||
          (word === 'di doi' && cleanNorm.includes('di doi'))
        ) {
          entities.people = val;
          break;
        }
      }
    }

    // 6.2 Ngân sách (Budget)
    if (cleanNorm.includes('nua trieu')) entities.budget = 500000;
    else if (cleanNorm.includes('1 trieu 2') || cleanNorm.includes('1tr2') || cleanNorm.includes('1t2')) entities.budget = 1200000;
    else if (cleanNorm.includes('1 trieu 5') || cleanNorm.includes('1tr5') || cleanNorm.includes('1t5') || cleanNorm.includes('1 trieu ruoi')) entities.budget = 1500000;
    else if (cleanNorm.includes('1 trieu') || cleanNorm.includes('mot trieu') || cleanNorm.includes('1tr') || cleanNorm.includes('1 cu')) entities.budget = 1000000;
    else if (cleanNorm.includes('2 trieu') || cleanNorm.includes('hai trieu') || cleanNorm.includes('2tr') || cleanNorm.includes('2 cu')) entities.budget = 2000000;
    else {
      const kMatch = rawText.match(/(\d+)\s*(k|nghin|ngan)/i) || cleanNorm.match(/(\d+)\s*(k|nghin|ngan)/);
      if (kMatch) {
        const val = parseInt(kMatch[1]);
        if (val > 0) entities.budget = val * 1000;
      } else {
        const fullMatch = rawText.match(/(\d{2,4})[.,](\d{3})/);
        if (fullMatch) {
          const val = parseInt(fullMatch[1] + fullMatch[2]);
          if (val >= 10000) entities.budget = val;
        } else if (/^\d{3,4}k?$/i.test(cleanNorm)) {
          const n = parseInt(cleanNorm.replace(/k/i, ''));
          if (n >= 50 && n <= 5000) entities.budget = n * 1000;
        }
      }
    }

    if (entities.budget && (cleanNorm.includes('moi nguoi') || cleanNorm.includes('moi khach') || cleanNorm.includes('dau nguoi'))) {
      const pCount = entities.people || memory?.numberOfPeople || 1;
      entities.budget = entities.budget * pCount;
    }

    // 6.3 Độ cay (Spicy Level)
    if (
      cleanNorm.includes('khong an cay') ||
      cleanNorm.includes('khong cay') ||
      cleanNorm.includes('k cay') ||
      cleanNorm.includes('ko cay') ||
      cleanNorm.includes('an nhat') ||
      cleanNorm.includes('dung bo ot') ||
      cleanNorm.includes('khong ot') ||
      cleanNorm.includes('non spicy') ||
      cleanNorm.includes('not spicy') ||
      cleanNorm.includes('no spicy')
    ) {
      entities.spicyLevel = 'NONE';
    } else if (cleanNorm.includes('it cay') || cleanNorm.includes('cay nhe') || cleanNorm.includes('cay vua') || cleanNorm.includes('mild spicy')) {
      entities.spicyLevel = 'MILD';
    } else if (cleanNorm.includes('an cay duoc') || cleanNorm.includes('thich an cay') || cleanNorm.includes('cay nhieu') || cleanNorm.includes('cay nong') || cleanNorm.includes('hot')) {
      entities.spicyLevel = 'HOT';
    }

    // 6.4 Dị ứng (Allergies)
    const allergyDict: Record<string, string> = {
      'dau phong': 'đậu phộng',
      'lac': 'đậu phộng',
      'hai san': 'hải sản',
      'tom': 'tôm',
      'cua': 'cua',
      'muc': 'mực',
      'sua': 'sữa',
      'gluten': 'gluten',
      'trung': 'trứng',
      'bot ngot': 'bột ngọt',
      'mi chinh': 'mì chính',
    };
    for (const [key, val] of Object.entries(allergyDict)) {
      if (cleanNorm.includes(`di ung ${key}`) || cleanNorm.includes(`khong an duoc ${key}`) || cleanNorm.includes(`kieng ${key}`)) {
        if (!entities.allergies) entities.allergies = [];
        entities.allergies.push(val);
      }
    }

    // 6.5 Đại từ & Tham chiếu thứ tự (Pronouns & Ordinals)
    if (cleanNorm.includes('mon dau tien') || cleanNorm.includes('mon thu 1') || cleanNorm.includes('mon 1') || cleanNorm.includes('mon dau') || cleanNorm.includes('first dish') || cleanNorm.includes('first one')) {
      entities.referencedProductIndex = 0;
      entities.referencedPronoun = 'first';
    } else if (cleanNorm.includes('mon thu 2') || cleanNorm.includes('mon 2') || cleanNorm.includes('thu hai') || cleanNorm.includes('second dish') || cleanNorm.includes('second one')) {
      entities.referencedProductIndex = 1;
      entities.referencedPronoun = 'second';
    } else if (cleanNorm.includes('mon thu 3') || cleanNorm.includes('mon 3') || cleanNorm.includes('thu ba') || cleanNorm.includes('third dish') || cleanNorm.includes('third one')) {
      entities.referencedProductIndex = 2;
      entities.referencedPronoun = 'third';
    } else if (cleanNorm.includes('mon cuoi') || cleanNorm.includes('mon cuoi cung') || cleanNorm.includes('last dish') || cleanNorm.includes('last one')) {
      entities.referencedProductIndex = -1;
      entities.referencedPronoun = 'last';
    } else if (
      cleanNorm.includes('mon nay') ||
      cleanNorm.includes('mon do') ||
      cleanNorm.includes('mon kia') ||
      cleanNorm.includes('cai nay') ||
      cleanNorm.includes('cai do') ||
      cleanNorm.includes('cai tren') ||
      cleanNorm.includes('mon tren') ||
      cleanNorm.includes('mon vua roi') ||
      cleanNorm.includes('mon luc nay') ||
      cleanNorm === 'no' ||
      cleanNorm.includes('no bao nhieu')
    ) {
      entities.referencedPronoun = 'this';
    }

    // Tham chiếu phương án / combo: "phương án 1", "phương án 2", "combo 1"
    if (cleanNorm.includes('phuong an 1') || cleanNorm.includes('combo 1') || cleanNorm.includes('pa 1') || cleanNorm.includes('mam 1')) {
      entities.referencedPlanIndex = 1;
    } else if (cleanNorm.includes('phuong an 2') || cleanNorm.includes('combo 2') || cleanNorm.includes('pa 2') || cleanNorm.includes('mam 2')) {
      entities.referencedPlanIndex = 2;
    } else if (cleanNorm.includes('phuong an 3') || cleanNorm.includes('combo 3') || cleanNorm.includes('pa 3') || cleanNorm.includes('mam 3')) {
      entities.referencedPlanIndex = 3;
    }

    // 6.6 Thời gian tự nhiên (Time & Date)
    if (cleanNorm.includes('hom nay') || cleanNorm.includes('toi nay') || cleanNorm.includes('trua nay') || cleanNorm.includes('chieu nay') || cleanNorm.includes('today') || cleanNorm.includes('tonight')) {
      entities.date = 'Hôm nay';
    } else if (cleanNorm.includes('ngay mai') || cleanNorm.includes('mai') || cleanNorm.includes('tomorrow')) {
      entities.date = 'Ngày mai';
    } else if (cleanNorm.includes('cuoi tuan') || cleanNorm.includes('weekend')) {
      entities.date = 'Cuối tuần';
    }

    // Giờ: "19h", "7h", "7 giờ tối", "19:30", "7h30", "khoảng 7h", "tầm 8h"
    const timeMatch = rawText.match(/(\d{1,2})(?:h|:)(\d{2})?/i) || cleanNorm.match(/(\d{1,2})\s*gio\s*(toi|sang|chieu)?/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1]);
      const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      let hour24 = h;
      if (cleanNorm.includes('toi') && h < 12) hour24 = h + 12;
      entities.time = `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // 6.7 Mã đơn hàng & SĐT
    const orderMatch = rawText.match(/HS-\d{8}-\d{3,4}|ORD-\S+/i);
    if (orderMatch) entities.orderCode = orderMatch[0];

    const phoneMatch = rawText.match(/0[3|5|7|8|9][0-9]{8}/);
    if (phoneMatch) entities.phone = phoneMatch[0];

    // 6.8 Món chay / Mặn
    if (cleanNorm.includes('an chay') || cleanNorm.includes('mon chay') || cleanNorm.includes('vegetarian') || cleanNorm.includes('vegan')) {
      entities.dietary = 'chay';
    }

    return entities;
  }

  /**
   * 7. Bộ phân loại Intent (Semantic Classifier with Scoring & Confidence)
   */
  static classifyIntent(
    rawText: string,
    cleanNorm: string,
    entities: NluEntities,
    memory?: ConversationMemory
  ): { primaryIntent: StandardChatIntent; confidence: number; allIntents: IntentMatch[] } {
    const scores: Partial<Record<StandardChatIntent, number>> = {};

    const addScore = (intent: StandardChatIntent, points: number) => {
      scores[intent] = Math.max(scores[intent] || 0, points);
    };

    const tokens = cleanNorm.split(/\s+/);
    const tokenSet = new Set(tokens);

    // --- 1. GREETING (Chào hỏi) ---
    const greetingTokens = new Set([
      'hello', 'hi', 'hey', 'yo', 'alo', 'chao',
      'oi', 'e'
    ]);
    const greetingPhrases = [
      'xin chao', 'good morning', 'good afternoon', 'good evening',
      'shop oi', 'nha hang oi', 'ban oi', 'e ban', 'cho minh hoi',
      'cho hoi cai nay', 'cho hoi', 'minh hoi chut', 'chao ban', 'chao shop',
      'chao huong sen', 'hi huong sen', 'hello huong sen', 'hey there'
    ];

    const hasGreetingPhrase = greetingPhrases.some((p) => cleanNorm === p || cleanNorm.startsWith(`${p} `) || cleanNorm.endsWith(` ${p}`));
    const hasGreetingToken = tokens.some((t) => greetingTokens.has(t));

    if (hasGreetingPhrase || hasGreetingToken) {
      // Kiểm tra nếu là câu chào đơn thuần (chỉ chứa từ chào hoặc từ xưng hô)
      const addressingTokens = new Set(['shop', 'nha', 'hang', 'huong', 'sen', 'ad', 'admin', 'ban', 'oi', 'em', 'anh', 'chi', 'co', 'chu']);
      const nonGreetingTokens = tokens.filter((t) => !greetingTokens.has(t) && !addressingTokens.has(t));

      if (nonGreetingTokens.length === 0 || hasGreetingPhrase) {
        addScore('GREETING', 0.95);
      } else {
        addScore('GREETING', 0.70);
      }
    }

    // --- 2. FAREWELL (Chào tạm biệt) ---
    const farewellWords = ['tam biet', 'bye', 'goodbye', 'chuc ngu ngon', 'hen gap lai'];
    if (farewellWords.some((w) => cleanNorm.includes(w))) {
      addScore('FAREWELL', 0.95);
    }

    // --- 3. THANKS (Cảm ơn) ---
    const thanksWords = ['cam on', 'thank', 'da ta', 'tuyet voi', 'rat tot'];
    if (thanksWords.some((w) => cleanNorm.includes(w))) {
      addScore('THANKS', 0.95);
    }

    // --- 4. SMALL_TALK & JOKES & CẢM XÚC ---
    if (
      cleanNorm === 'ok' ||
      cleanNorm === 'duoc' ||
      cleanNorm === 'duoc roi' ||
      cleanNorm === 'nhat tri' ||
      cleanNorm === 'haha' ||
      cleanNorm === 'hihi' ||
      cleanNorm.includes('ban ten gi') ||
      cleanNorm.includes('ban la ai') ||
      cleanNorm.includes('ban lam gi') ||
      cleanNorm.includes('ban la robot')
    ) {
      addScore('SMALL_TALK', 0.92);
    }

    if (
      cleanNorm.includes('an het menu') ||
      cleanNorm.includes('100 mon') ||
      cleanNorm.includes('doi qua') ||
      cleanNorm.includes('doi xiu') ||
      cleanNorm.includes('doi sap chet')
    ) {
      addScore('JOKE_OR_FUN', 0.95);
    }

    // --- 5. OUT_OF_SCOPE (Ngoài phạm vi nhà hàng) ---
    if (
      cleanNorm.includes('thoi tiet') ||
      cleanNorm.includes('tin tuc') ||
      cleanNorm.includes('chinh tri') ||
      cleanNorm.includes('viet code') ||
      cleanNorm.includes('giai toan') ||
      cleanNorm.includes('bitcoin') ||
      cleanNorm.includes('chung khoan')
    ) {
      addScore('OUT_OF_SCOPE', 0.95);
    }

    // --- 6. ADD_TO_CART / REMOVE_FROM_CART / VIEW_CART ---
    if (
      cleanNorm.includes('them vao gio') ||
      cleanNorm.includes('them vo gio') ||
      cleanNorm.includes('cho vao gio') ||
      cleanNorm.includes('lay mon nay') ||
      cleanNorm.includes('lay mon do') ||
      cleanNorm.includes('dat mon nay') ||
      cleanNorm.includes('them mon nay') ||
      cleanNorm.includes('them ca 2') ||
      cleanNorm.includes('them tat ca')
    ) {
      addScore('ADD_TO_CART', 0.95);
    }

    if (cleanNorm.includes('xoa khoi gio') || cleanNorm.includes('bo mon nay')) {
      addScore('REMOVE_FROM_CART', 0.92);
    }

    if (cleanNorm.includes('xem gio hang') || cleanNorm.includes('gio hang co gi') || cleanNorm === 'gio hang') {
      addScore('VIEW_CART', 0.95);
    }

    // --- 7. CHOOSE PLAN (Chọn phương án / combo) ---
    if (
      entities.referencedPlanIndex ||
      cleanNorm.includes('chon phuong an') ||
      cleanNorm.includes('lay phuong an') ||
      cleanNorm.includes('chon combo') ||
      cleanNorm.includes('lay combo')
    ) {
      addScore('MEAL_RECOMMENDATION', 0.95);
    }

    // --- 8. PRODUCT_PRICE (Hỏi giá món ăn) ---
    if (
      cleanNorm.includes('bao nhieu tien') ||
      cleanNorm.includes('gia bao nhieu') ||
      cleanNorm.includes('gia nhiu') ||
      cleanNorm.includes('bao nhieu mot phan') ||
      cleanNorm.includes('gia mon nay') ||
      cleanNorm.includes('gia mon') ||
      cleanNorm.includes('price') ||
      cleanNorm === 'gia' ||
      cleanNorm === 'gia?' ||
      (entities.referencedProductIndex !== undefined && (cleanNorm.includes('bao nhieu') || cleanNorm.includes('gia') || cleanNorm.includes('nhiu'))) ||
      (entities.referencedPronoun && (cleanNorm.includes('bao nhieu') || cleanNorm.includes('gia') || cleanNorm.includes('nhiu')))
    ) {
      addScore('PRODUCT_PRICE', 0.95);
    }

    // --- 9. PRODUCT_AVAILABILITY (Còn hay hết món) ---
    if (
      cleanNorm.includes('con khong') ||
      cleanNorm.includes('con hok') ||
      cleanNorm.includes('con ko') ||
      cleanNorm.includes('con k') ||
      cleanNorm.includes('het chua') ||
      cleanNorm.includes('co con khong') ||
      cleanNorm.includes('co con') ||
      cleanNorm.includes('con mon') ||
      cleanNorm.includes('con mon nay') ||
      cleanNorm.includes('con mon nay khong') ||
      cleanNorm.includes('con mon nay ko') ||
      cleanNorm.includes('con mon nay k') ||
      cleanNorm.includes('con mon nay hok') ||
      cleanNorm.includes('co mon nay khong') ||
      cleanNorm.includes('co mon nay ko') ||
      cleanNorm.includes('co mon nay k')
    ) {
      addScore('PRODUCT_AVAILABILITY', 0.95);
    }

    // --- 10. PRODUCT_SPICY (Độ cay) ---
    if (
      cleanNorm.includes('co cay khong') ||
      cleanNorm.includes('cay lam khong') ||
      cleanNorm.includes('do cay') ||
      cleanNorm.includes('mon cay') ||
      cleanNorm.includes('khong an cay') ||
      cleanNorm.includes('khong cay') ||
      cleanNorm.includes('k cay') ||
      cleanNorm.includes('ko cay') ||
      cleanNorm.includes('an nhat') ||
      cleanNorm.includes('dung bo ot') ||
      cleanNorm.includes('khong ot')
    ) {
      addScore('PRODUCT_SPICY', 0.95);
    }

    // --- 11. PRODUCT_INGREDIENT (Hỏi nguyên liệu & thành phần) ---
    if (
      cleanNorm.includes('nguyen lieu') ||
      cleanNorm.includes('thanh phan') ||
      cleanNorm.includes('nau tu gi') ||
      cleanNorm.includes('co nhung gi') ||
      cleanNorm.includes('la mon gi')
    ) {
      addScore('PRODUCT_INGREDIENT', 0.92);
    }

    // --- 12. PRODUCT_ALLERGEN (Dị ứng thực phẩm) ---
    if (entities.allergies && entities.allergies.length > 0) {
      addScore('PRODUCT_ALLERGEN', 0.95);
    }

    // --- 13. COMPARE_PRODUCTS (So sánh 2 món) ---
    if (
      cleanNorm.includes('khac nhau the nao') ||
      cleanNorm.includes('so sanh') ||
      cleanNorm.includes('hay la') ||
      cleanNorm.includes('nen chon mon nao')
    ) {
      addScore('COMPARE_PRODUCTS', 0.92);
    }

    // --- 14. PRODUCT_REVIEW (Đánh giá thực khách) ---
    if (
      cleanNorm.includes('danh gia') ||
      cleanNorm.includes('review') ||
      cleanNorm.includes('an ngon khong') ||
      cleanNorm.includes('nhan xet')
    ) {
      addScore('PRODUCT_REVIEW', 0.90);
    }

    // --- 15. BEST_SELLER & POPULAR_PRODUCTS ---
    if (
      cleanNorm.includes('ban chay') ||
      cleanNorm.includes('best seller') ||
      cleanNorm.includes('duoc goi nhieu') ||
      cleanNorm.includes('mon hot') ||
      cleanNorm.includes('noi bat')
    ) {
      addScore('BEST_SELLER', 0.95);
    } else if (cleanNorm.includes('dac trung') || cleanNorm.includes('ngon nhat') || cleanNorm.includes('dac sac')) {
      addScore('POPULAR_PRODUCTS', 0.92);
    }

    // --- 16. RECOMMEND_FOOD / MEAL_RECOMMENDATION ---
    const recommendPhrases = [
      'an gi', 'an gi gio', 'gio an gi', 'nay an gi', 'co gi ngon', 'co gi hot',
      'co gi dac biet', 'mon nao ngon', 'mon gi ngon', 'co mon gi ngon', 'mon nao ngonn',
      'an mon gi', 'mon ngon', 'mon nao on', 'mon nao dang thu', 'goi y', 'tu van',
      'nen an gi', 'nen goi gi', 'mot bua', 'an com', 'phan van', 'chua biet an gi',
      'recommend'
    ];
    if (recommendPhrases.some((p) => cleanNorm.includes(p))) {
      addScore('RECOMMEND_FOOD', 0.90);
    }

    // Nếu có số người hoặc ngân sách được cấp và câu hỏi mang tính gợi ý
    if (entities.people || entities.budget) {
      addScore('RECOMMEND_FOOD', 0.85);
      if (entities.budget) addScore('BUDGET_RECOMMENDATION', 0.80);
    }

    // --- 17. VIEW_MENU / SEARCH_MENU ---
    if (
      cleanNorm === 'thuc don' ||
      cleanNorm === 'menu' ||
      cleanNorm.includes('thuc don') ||
      cleanNorm.includes('menu') ||
      cleanNorm.includes('coi menu') ||
      cleanNorm.includes('xem menu') ||
      cleanNorm.includes('coi thuc don') ||
      cleanNorm.includes('xem thuc don') ||
      cleanNorm.includes('co nhung mon gi') ||
      cleanNorm.includes('danh sach mon') ||
      cleanNorm.includes('toan bo thuc don')
    ) {
      addScore('VIEW_MENU', 0.95);
    }

    // Tìm kiếm món cụ thể (VD: "có món gà không", "món cá", "lẩu", "món chay")
    const searchTerms = ['ga', 'bo', 'heo', 'ca', 'hai san', 'lau', 'canh', 'chay', 'com', 'salad', 'goi', 'nuoc', 'che'];
    if (
      searchTerms.some((t) => tokenSet.has(t)) &&
      (cleanNorm.includes('co mon') || cleanNorm.includes('tim mon') || cleanNorm.includes('xem mon') || searchTerms.some((t) => cleanNorm === t || cleanNorm === `mon ${t}`))
    ) {
      addScore('SEARCH_MENU', 0.90);
    }

    // --- 18. RESERVATION (Đặt bàn & Kiểm tra bàn) ---
    if (
      cleanNorm.includes('dat ban') ||
      cleanNorm.includes('giu ban') ||
      cleanNorm.includes('book ban') ||
      cleanNorm.includes('book table') ||
      cleanNorm.includes('book a table') ||
      cleanNorm.includes('con ban khong') ||
      cleanNorm.includes('con ban') ||
      cleanNorm.includes('ban con khong') ||
      cleanNorm.includes('dat cho') ||
      cleanNorm.includes('con cho khong') ||
      cleanNorm.includes('reservation')
    ) {
      addScore('RESERVATION', 0.95);
    }

    if (cleanNorm.includes('huy ban') || cleanNorm.includes('cancel reservation')) {
      addScore('CANCEL_RESERVATION', 0.95);
    }

    // --- 19. MY_ORDER / ORDER_STATUS (Tra cứu đơn hàng) ---
    if (
      entities.orderCode ||
      entities.phone ||
      cleanNorm.includes('kiem tra don') ||
      cleanNorm.includes('tra cuu don') ||
      cleanNorm.includes('don cua toi') ||
      cleanNorm.includes('bep lam chua') ||
      cleanNorm.includes('don dang o dau') ||
      cleanNorm.includes('check order') ||
      cleanNorm === 'order' ||
      cleanNorm === 'don hang'
    ) {
      addScore('ORDER_STATUS', 0.95);
    }

    // --- 20. REQUEST_PAYMENT (Thanh toán / Tính tiền) ---
    if (
      cleanNorm.includes('thanh toan') ||
      cleanNorm.includes('tinh tien') ||
      cleanNorm.includes('goi tinh tien') ||
      cleanNorm.includes('lay hoa don') ||
      cleanNorm.includes('pay') ||
      cleanNorm.includes('bill')
    ) {
      addScore('REQUEST_PAYMENT', 0.95);
    }

    // --- 21. OPENING_HOURS / LOCATION / CONTACT / RESTAURANT_INFO ---
    if (cleanNorm.includes('mo cua') || cleanNorm.includes('dong cua') || cleanNorm.includes('may gio') || cleanNorm.includes('opening hours')) {
      addScore('OPENING_HOURS', 0.95);
    } else if (cleanNorm.includes('dia chi') || cleanNorm.includes('o dau') || cleanNorm.includes('vi tri') || cleanNorm.includes('where')) {
      addScore('LOCATION', 0.95);
    } else if (cleanNorm.includes('hotline') || cleanNorm.includes('so dien thoai') || cleanNorm.includes('sdt') || cleanNorm.includes('lien he') || cleanNorm.includes('contact')) {
      addScore('CONTACT', 0.95);
    } else if (cleanNorm.includes('phong vip') || cleanNorm.includes('chinh sach') || cleanNorm.includes('gioi thieu nha hang') || cleanNorm.includes('thong tin quan')) {
      addScore('RESTAURANT_INFO', 0.85);
    }

    // --- 22. CONTEXT-BASED ELLIPTICAL RESOLUTION ---
    // Khách nhắn câu cụt trong ngữ cảnh đang tiếp diễn:
    if (Object.keys(scores).length === 0 || Math.max(...Object.values(scores)) < 0.5) {
      // 1. Chỉ nhắn số tiền: "500k", "600k"
      if (entities.budget && !cleanNorm.includes('nguoi') && memory?.numberOfPeople) {
        addScore('RECOMMEND_FOOD', 0.88);
      }
      // 2. Chỉ nhắn số người: "4 người"
      else if (entities.people && !cleanNorm.includes('tien') && !cleanNorm.includes('k')) {
        addScore('RECOMMEND_FOOD', 0.85);
      }
      // 3. Chỉ hỏi: "còn không?" hoặc "bao nhiêu?"
      else if (cleanNorm === 'con khong' || cleanNorm === 'con hok' || cleanNorm === 'con ko') {
        addScore('PRODUCT_AVAILABILITY', 0.88);
      } else if (cleanNorm === 'bao nhieu' || cleanNorm === 'gia sao' || cleanNorm === 'gia?') {
        addScore('PRODUCT_PRICE', 0.88);
      }
      // 4. Chỉ nhắn giờ: "7h", "19h" khi đang trong luồng đặt bàn
      else if (entities.time && (memory?.lastIntent === 'RESERVATION' || memory?.stage === 'RESERVING' || cleanNorm.match(/^\d{1,2}h(\d{2})?$/))) {
        addScore('RESERVATION', 0.90);
      }
    }

    // Chuyển scores thành IntentMatch[] có sắp xếp theo điểm số
    const sortedIntents: IntentMatch[] = Object.entries(scores)
      .map(([intent, score]) => ({
        intent: intent as StandardChatIntent,
        confidence: Math.min(1.0, score),
        score,
      }))
      .sort((a, b) => b.score - a.score);

    const primaryIntent: StandardChatIntent = sortedIntents.length > 0 ? sortedIntents[0].intent : 'UNKNOWN';
    const confidence = sortedIntents.length > 0 ? sortedIntents[0].confidence : 0.0;

    return { primaryIntent, confidence, allIntents: sortedIntents };
  }

  /**
   * 8. PIPELINE XỬ LÝ TOÀN DIỆN (NLU PIPELINE)
   */
  static process(rawText: string, memory?: ConversationMemory): NluResult {
    // Bước 1: Trích xuất Emojis
    const emojis = this.extractEmojis(rawText);

    // Bước 2: Chuẩn hóa tiếng lóng & từ viết tắt
    const { normalized, cleanNorm } = this.normalizeSlangAndSpelling(rawText);

    // Bước 3: Nhận diện ngôn ngữ
    const detectedLanguage = this.detectLanguage(rawText, cleanNorm);

    // Bước 4: Trích xuất thực thể (Entities)
    const entities = this.extractEntities(rawText, cleanNorm, memory);

    // Bước 5: Phân loại ý định (Intent Classification with Confidence)
    const { primaryIntent, confidence, allIntents } = this.classifyIntent(rawText, cleanNorm, entities, memory);

    // Bước 6: Kiểm tra multi-intent flags
    const hasGreeting = allIntents.some((i) => i.intent === 'GREETING');
    const hasThanks = allIntents.some((i) => i.intent === 'THANKS');
    const hasFarewell = allIntents.some((i) => i.intent === 'FAREWELL');
    const isJoke = allIntents.some((i) => i.intent === 'JOKE_OR_FUN');

    return {
      rawText,
      normalizedText: normalized,
      cleanNorm,
      detectedLanguage,
      primaryIntent,
      intents: allIntents,
      confidence,
      entities,
      emojis,
      hasGreeting,
      hasThanks,
      hasFarewell,
      isJoke,
    };
  }
}
