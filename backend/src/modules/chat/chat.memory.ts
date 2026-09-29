import { ConversationMemory } from './chat.types.js';
import { ChatNLU } from './chat.nlu.js';

export function normalizeVietnamese(str: string): string {
  return ChatNLU.normalizeVietnamese(str);
}

export class ChatMemoryManager {
  private static store = new Map<string, { memory: ConversationMemory; updatedAt: number }>();
  private static readonly TTL_MS = 2 * 60 * 60 * 1000; // 2 giờ
  private static readonly MAX_HISTORY_TURNS = 10; // Giới hạn context window (10 lượt gần nhất)

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
      history: [],
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
        history: memory.history || [],
      };
    }

    this.store.set(conversationId, { memory, updatedAt: Date.now() });
    return memory;
  }

  /**
   * Lưu memory cập nhật và kiểm soát kích thước context window
   */
  static saveMemory(conversationId: string = 'default', memory: ConversationMemory): void {
    if (memory.history && memory.history.length > this.MAX_HISTORY_TURNS * 2) {
      memory.history = memory.history.slice(-this.MAX_HISTORY_TURNS * 2);
    }
    this.store.set(conversationId, { memory, updatedAt: Date.now() });
  }

  /**
   * Ghi lại lượt hội thoại (Customer & Assistant) vào lịch sử ngữ cảnh
   */
  static recordTurn(
    conversationId: string,
    customerText: string,
    assistantText: string,
    intent?: any
  ): void {
    const memory = this.getOrCreateMemory(conversationId);
    if (!memory.history) memory.history = [];

    memory.history.push({ role: 'customer', text: customerText, intent, timestamp: Date.now() });
    memory.history.push({ role: 'assistant', text: assistantText, intent, timestamp: Date.now() });

    if (memory.history.length > this.MAX_HISTORY_TURNS * 2) {
      memory.history = memory.history.slice(-this.MAX_HISTORY_TURNS * 2);
    }

    this.saveMemory(conversationId, memory);
  }

  /**
   * Trích xuất các thực thể tự nhiên (Số người, Ngân sách, Khẩu vị, Dị ứng...) sử dụng ChatNLU
   */
  static extractEntities(rawMsg: string, currentMemory: ConversationMemory): ConversationMemory {
    const nlu = ChatNLU.process(rawMsg, currentMemory);
    const updated = { ...currentMemory };

    if (nlu.entities.people !== undefined) {
      updated.numberOfPeople = nlu.entities.people;
    }

    if (nlu.entities.budget !== undefined) {
      updated.budget = nlu.entities.budget;
    }

    if (nlu.entities.spicyLevel !== undefined) {
      updated.spicyPreference = nlu.entities.spicyLevel;
    }

    if (nlu.entities.allergies && nlu.entities.allergies.length > 0) {
      for (const alg of nlu.entities.allergies) {
        if (!updated.allergies.includes(alg)) {
          updated.allergies.push(alg);
        }
      }
    }

    if (nlu.entities.orderCode) {
      updated.activeOrderCode = nlu.entities.orderCode;
    }

    return updated;
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
