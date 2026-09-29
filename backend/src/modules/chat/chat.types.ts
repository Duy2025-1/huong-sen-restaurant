/**
 * Kiểu dữ liệu và Intent cho hệ thống Trợ lý Nhà hàng Thông minh Hương Sen
 */

export type ChatIntent =
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

export interface RecommendationPlan {
  planId: number;
  title: string;
  badge?: string;
  description: string;
  dishes: any[];
  subtotal: number;
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
  activeOrderCode?: string;
  stage?: 'IDLE' | 'RECOMMENDING' | 'CONFIRMING_PLAN' | 'RESERVING';
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
}
