import { ConversationMemory } from './chat.types.js';

export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

export class ChatMemoryManager {
  private static store = new Map<string, { memory: ConversationMemory; updatedAt: number }>();
  private static readonly TTL_MS = 2 * 60 * 60 * 1000; // 2 giờ

  /**
   * Lấy hoặc khởi tạo memory cho conversation
   */
  static getOrCreateMemory(conversationId: string = 'default', clientMemory?: ConversationMemory): ConversationMemory {
    this.cleanExpiredSessions();

    const existing = this.store.get(conversationId);
    let memory: ConversationMemory = existing?.memory || {
      foodPreferences: [],
      dislikes: [],
      allergies: [],
      favoriteCategories: [],
      lastMentionedProducts: [],
      stage: 'IDLE',
    };

    // Hợp nhất với client memory nếu có (giúp bảo toàn khi F5 hoặc multi-tab)
    if (clientMemory) {
      memory = {
        ...memory,
        ...clientMemory,
        foodPreferences: Array.from(new Set([...memory.foodPreferences, ...(clientMemory.foodPreferences || [])])),
        dislikes: Array.from(new Set([...memory.dislikes, ...(clientMemory.dislikes || [])])),
        allergies: Array.from(new Set([...memory.allergies, ...(clientMemory.allergies || [])])),
        favoriteCategories: Array.from(new Set([...memory.favoriteCategories, ...(clientMemory.favoriteCategories || [])])),
      };
    }

    this.store.set(conversationId, { memory, updatedAt: Date.now() });
    return memory;
  }

  /**
   * Lưu memory cập nhật
   */
  static saveMemory(conversationId: string = 'default', memory: ConversationMemory): void {
    this.store.set(conversationId, { memory, updatedAt: Date.now() });
  }

  /**
   * Trích xuất các thực thể tự nhiên (Số người, Ngân sách, Khẩu vị, Dị ứng...) từ tin nhắn
   */
  static extractEntities(rawMsg: string, currentMemory: ConversationMemory): ConversationMemory {
    const updated = { ...currentMemory };
    const norm = normalizeVietnamese(rawMsg);
    // Chuỗi làm sạch dấu câu để so khớp từ khóa chính xác
    const cleanNorm = norm.replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Trích xuất số người
    const people = this.extractPeopleCount(rawMsg, cleanNorm);
    if (people !== undefined) {
      updated.numberOfPeople = people;
    }

    // 2. Trích xuất ngân sách
    const budget = this.extractBudget(rawMsg, cleanNorm);
    if (budget !== undefined) {
      // Nếu khách bảo "mỗi người 200k" và đã có số người
      if (cleanNorm.includes('moi nguoi') || cleanNorm.includes('moi khach') || cleanNorm.includes('dau nguoi')) {
        if (updated.numberOfPeople) {
          updated.budget = budget * updated.numberOfPeople;
        } else {
          updated.budget = budget;
        }
      } else {
        updated.budget = budget;
      }
    }

    // 3. Trích xuất độ cay (SPICY LEVEL) - BẢO TOÀN TRONG SUỐT PHIÊN
    if (
      cleanNorm.includes('khong an cay') ||
      cleanNorm.includes('khong cay') ||
      cleanNorm.includes('an nhat') ||
      cleanNorm.includes('chiu cay kem') ||
      cleanNorm.includes('dung bo ot') ||
      cleanNorm.includes('khong ot')
    ) {
      updated.spicyPreference = 'NONE';
    } else if (cleanNorm.includes('it cay') || cleanNorm.includes('cay nhe') || cleanNorm.includes('cay vua')) {
      updated.spicyPreference = 'MILD';
    } else if (cleanNorm.includes('an cay duoc') || cleanNorm.includes('thich an cay') || cleanNorm.includes('cay nhieu')) {
      updated.spicyPreference = 'HOT';
    }

    // 4. Trích xuất dị ứng (ALLERGIES)
    const allergyKeywords: Record<string, string> = {
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

    for (const [key, label] of Object.entries(allergyKeywords)) {
      if (cleanNorm.includes(`di ung ${key}`) || cleanNorm.includes(`khong an duoc ${key}`)) {
        if (!updated.allergies.includes(label)) {
          updated.allergies.push(label);
        }
      }
    }

    // 5. Trích xuất sở thích món (FOOD PREFERENCES)
    const prefKeywords: Record<string, string> = {
      'thich ca': 'món cá',
      'me mon ca': 'món cá',
      'muon an ca': 'món cá',
      'mon ca': 'món cá',
      'thich ga': 'món gà',
      'me mon ga': 'món gà',
      'thich bo': 'món bò',
      'thich thit bo': 'món bò',
      'thich heo': 'món heo',
      'thich lau': 'lẩu',
      'an lau': 'lẩu',
      'thich mon nuoc': 'món nước',
      'mon nuoc': 'món nước',
      'thich mon nuong': 'món nướng',
      'thich mon viet': 'món Việt truyền thống',
      'mon viet truyen thong': 'món Việt truyền thống',
      'mon viet': 'món Việt truyền thống',
      'an com': 'cơm niêu',
      'thich com': 'cơm niêu',
      'thich chay': 'món chay',
      'an chay': 'món chay',
    };

    for (const [key, label] of Object.entries(prefKeywords)) {
      if (cleanNorm.includes(key)) {
        if (!updated.foodPreferences.includes(label)) {
          updated.foodPreferences.push(label);
        }
      }
    }

    // 6. Trích xuất món không thích (DISLIKES)
    const dislikeKeywords: Record<string, string> = {
      'khong thich hai san': 'hải sản',
      'khong an hai san': 'hải sản',
      'khong thich hanh': 'hành',
      'khong an hanh': 'hành',
      'khong thich do ngot': 'đồ ngọt',
      'khong thich thit mo': 'thịt mỡ',
    };

    for (const [key, label] of Object.entries(dislikeKeywords)) {
      if (cleanNorm.includes(key)) {
        if (!updated.dislikes.includes(label)) {
          updated.dislikes.push(label);
        }
      }
    }

    return updated;
  }

  /**
   * Trích xuất số người từ tiếng Việt tự nhiên
   */
  private static extractPeopleCount(rawMsg: string, cleanNorm: string): number | undefined {
    // 1. Dạng số: "4 người", "2 khách", "cho 5 người", "nhóm 6 người"
    const matchNum = cleanNorm.match(/(\d+)\s*(nguoi|khach|cho|suat|phan|ban)/i);
    if (matchNum) {
      const n = parseInt(matchNum[1]);
      if (n > 0 && n <= 100) return n;
    }

    // 2. Dạng chữ: "hai người", "bốn người", "đi đôi", "ba người"
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

    for (const [word, num] of Object.entries(wordNumbers)) {
      if (cleanNorm.includes(`${word} nguoi`) || cleanNorm.includes(`${word} khach`) || cleanNorm.includes(`${word} ban`) || (word === 'di doi' && cleanNorm.includes('di doi'))) {
        return num;
      }
    }

    return undefined;
  }

  /**
   * Trích xuất ngân sách từ tiếng Việt tự nhiên
   */
  private static extractBudget(rawMsg: string, cleanNorm: string): number | undefined {
    // "nửa triệu" -> 500.000
    if (cleanNorm.includes('nua trieu')) return 500000;
    if (cleanNorm.includes('1 trieu') || cleanNorm.includes('mot trieu')) return 1000000;
    if (cleanNorm.includes('2 trieu') || cleanNorm.includes('hai trieu')) return 2000000;

    // "khoảng 500k", "tầm 600 nghìn", "dưới 700.000", "700k"
    const kMatch = rawMsg.match(/(\d+)\s*(k|nghin|ngan)/i) || cleanNorm.match(/(\d+)\s*(k|nghin|ngan)/);
    if (kMatch) {
      const n = parseInt(kMatch[1]);
      if (n > 0) return n * 1000;
    }

    // Dạng đầy đủ: "500000", "500.000"
    const fullMatch = rawMsg.match(/(\d{2,4})[.,](\d{3})/);
    if (fullMatch) {
      const n = parseInt(fullMatch[1] + fullMatch[2]);
      if (n >= 10000) return n;
    }

    return undefined;
  }

  private static cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now - value.updatedAt > this.TTL_MS) {
        this.store.delete(key);
      }
    }
  }
}
