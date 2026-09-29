/**
 * Kiểu dữ liệu, NLU và Intent cho hệ thống Trợ lý Nhà hàng Thông minh Hương Sen
 */

export type StandardChatIntent =
  | 'GREETING'
  | 'FAREWELL'
  | 'THANKS'
  | 'SMALL_TALK'
  | 'HELP'
  | 'VIEW_MENU'
  | 'SEARCH_MENU'
  | 'RECOMMEND_FOOD'
  | 'PRODUCT_DETAIL'
  | 'PRODUCT_PRICE'
  | 'PRODUCT_AVAILABILITY'
  | 'PRODUCT_INGREDIENT'
  | 'PRODUCT_ALLERGEN'
  | 'PRODUCT_SPICY'
  | 'PRODUCT_REVIEW'
  | 'COMPARE_PRODUCTS'
  | 'BEST_SELLER'
  | 'POPULAR_PRODUCTS'
  | 'BUDGET_RECOMMENDATION'
  | 'MEAL_RECOMMENDATION'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'VIEW_CART'
  | 'CHECKOUT'
  | 'RESTAURANT_INFO'
  | 'OPENING_HOURS'
  | 'LOCATION'
  | 'CONTACT'
  | 'RESERVATION'
  | 'CHECK_RESERVATION'
  | 'CANCEL_RESERVATION'
  | 'MY_ORDER'
  | 'ORDER_STATUS'
  | 'REQUEST_PAYMENT'
  | 'PROMOTION'
  | 'COMPLAINT'
  | 'FEEDBACK'
  | 'HUMAN_SUPPORT'
  | 'JOKE_OR_FUN'
  | 'OUT_OF_SCOPE'
  | 'UNKNOWN';

// Tương thích ngược với các tên intent cũ nếu có
export type LegacyChatIntent =
  | 'INTENT_SMALL_TALK'
  | 'INTENT_SECURITY_GUARD'
  | 'INTENT_RECOMMEND_FOOD'
  | 'INTENT_CHOOSE_PLAN'
  | 'INTENT_COMPARE_FOOD'
  | 'INTENT_EXPLAIN_FOOD'
  | 'INTENT_CHECK_PRICE'
  | 'INTENT_CHECK_AVAILABILITY'
  | 'INTENT_CHECK_INGREDIENT'
  | 'INTENT_CHECK_ALLERGEN'
  | 'INTENT_CHECK_SPICY_LEVEL'
  | 'INTENT_CHECK_REVIEW'
  | 'INTENT_CHECK_POPULAR_FOOD'
  | 'INTENT_CHECK_BEST_SELLER'
  | 'INTENT_SEARCH_MENU'
  | 'INTENT_DIETARY_SEARCH'
  | 'INTENT_RESERVATION'
  | 'INTENT_ORDER_LOOKUP'
  | 'INTENT_REQUEST_PAYMENT'
  | 'INTENT_RESTAURANT_INFO'
  | 'INTENT_ADD_TO_CART'
  | 'INTENT_UNKNOWN';

export type ChatIntent = StandardChatIntent | LegacyChatIntent;

export interface IntentMatch {
  intent: StandardChatIntent;
  confidence: number;
  score: number;
  explanation?: string;
}

export interface NluEntities {
  people?: number;
  budget?: number;
  budgetMin?: number;
  budgetMax?: number;
  date?: string;
  time?: string;
  dateTimeIso?: string;
  productName?: string;
  referencedProductIndex?: number; // 0: đầu tiên, 1: thứ 2, etc.
  referencedPlanIndex?: number; // 1: phương án 1, 2: phương án 2, etc.
  referencedPronoun?: 'this' | 'that' | 'previous' | 'first' | 'second' | 'third' | 'last';
  category?: string;
  ingredient?: string;
  spicyLevel?: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT';
  quantity?: number;
  orderCode?: string;
  phone?: string;
  tableNumber?: string;
  dietary?: 'chay' | 'man';
  allergies?: string[];
  isNegated?: boolean;
}

export interface NluResult {
  rawText: string;
  normalizedText: string;
  cleanNorm: string;
  detectedLanguage: 'vi' | 'en' | 'mixed';
  primaryIntent: StandardChatIntent;
  intents: IntentMatch[];
  confidence: number;
  entities: NluEntities;
  emojis: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  hasGreeting?: boolean;
  hasThanks?: boolean;
  hasFarewell?: boolean;
  isJoke?: boolean;
}

export interface RecommendationPlan {
  planId: number;
  title: string;
  badge?: string;
  description: string;
  dishes: any[];
  subtotal: number;
}

export interface ConversationHistoryItem {
  role: 'customer' | 'assistant';
  text: string;
  intent?: ChatIntent;
  timestamp?: number;
}

export interface ConversationMemory {
  numberOfPeople?: number;
  budget?: number;
  foodPreferences: string[];
  dislikes: string[];
  allergies: string[];
  spicyPreference?: 'NONE' | 'MILD' | 'MEDIUM' | 'HOT' | 'ANY';
  favoriteCategories: string[];
  lastRecommendations?: RecommendationPlan[];
  lastMentionedProducts: any[];
  lastReferencedProduct?: any;
  reservationDraft?: {
    people?: number;
    date?: string;
    time?: string;
    note?: string;
    area?: string;
  };
  activeOrderCode?: string;
  stage?: 'IDLE' | 'RECOMMENDING' | 'CONFIRMING_PLAN' | 'RESERVING';
  lastIntent?: StandardChatIntent;
  lastTopic?: string;
  history?: ConversationHistoryItem[];
}

export interface ChatContext {
  conversationId?: string;
  currentPage?: string;
  currentDish?: {
    id?: number;
    name?: string;
    slug?: string;
  };
  customerPhone?: string;
  orderCode?: string;
  tableToken?: string;
  user?: {
    id?: number;
    fullName?: string;
    phone?: string;
  };
  memory?: ConversationMemory;
}

export interface ChatAction {
  type: 'view_menu' | 'open_reserve' | 'view_order' | 'add_to_cart' | 'view_dish';
  label?: string;
  payload?: any;
}

export interface ChatMessageResponse {
  id: string;
  role: 'assistant';
  text: string;
  intent: ChatIntent;
  memory: ConversationMemory;
  products?: any[];
  recommendations?: RecommendationPlan[];
  order?: any;
  quickReplies?: string[];
  action?: ChatAction;
  allergensWarning?: string;
  confidence?: number;
}
