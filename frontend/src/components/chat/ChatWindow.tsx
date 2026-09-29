import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Minus, 
  Send, 
  Sparkles, 
  RotateCcw,
  UtensilsCrossed,
  CalendarDays,
  ShoppingBag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';
import { socket } from '../../services/socket';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChatProductCard, type ChatProduct } from './ChatProductCard';
import { ChatOrderCard, type ChatOrder } from './ChatOrderCard';

export interface RecommendationPlan {
  planId: string;
  title: string;
  description: string;
  subtotal: number;
  dishes: ChatProduct[];
}

export interface ChatMessage {
  id: string;
  role: 'customer' | 'assistant';
  text: string;
  products?: ChatProduct[];
  recommendations?: RecommendationPlan[];
  order?: ChatOrder;
  quickReplies?: string[];
  action?: {
    type: 'view_menu' | 'open_reserve' | 'view_order' | 'add_to_cart';
    payload?: any;
    label?: string;
  };
  timestamp?: string;
  isError?: boolean;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

const DEFAULT_WELCOME_PROMPTS = [
  'Xem thực đơn',
  'Món nào được gọi nhiều?',
  'Tôi muốn đặt bàn',
  'Có món chay không?',
  'Có món ít cay không?',
  'Kiểm tra đơn hàng',
  'Liên hệ nhà hàng',
];

export const ChatWindow: React.FC<ChatWindowProps> = ({
  isOpen,
  onClose,
  onMinimize,
}) => {
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();
  const { user } = useAuth();

  const [conversationId, setConversationId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('rms_chat_conversation_id');
      if (saved) return saved;
      const newId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('rms_chat_conversation_id', newId);
      return newId;
    } catch {
      return `web-${Date.now()}`;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('rms_chat_messages');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<string[]>(DEFAULT_WELCOME_PROMPTS);
  const [trackedOrderCodes, setTrackedOrderCodes] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lưu lịch sử chat vào sessionStorage (theo phiên khách duyệt)
  useEffect(() => {
    try {
      sessionStorage.setItem('rms_chat_messages', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToBottom(false);
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading]);

  // Tải danh sách câu hỏi gợi ý từ backend
  useEffect(() => {
    let isMounted = true;
    api.get('/chat/quick-suggestions')
      .then((res) => {
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setQuickPrompts(res.data);
        }
      })
      .catch(() => {
        // Giữ default prompts nếu lỗi mạng
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Lắng nghe cập nhật trạng thái đơn hàng theo thời gian thực qua Socket.io
  useEffect(() => {
    function handleOrderStatusUpdate(data: any) {
      if (!data || !data.orderCode) return;
      if (trackedOrderCodes.includes(data.orderCode)) {
        // Cập nhật thẻ đơn trong tin nhắn chat
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.order && msg.order.code === data.orderCode) {
              return {
                ...msg,
                order: {
                  ...msg.order,
                  status: data.status || msg.order.status,
                },
              };
            }
            return msg;
          })
        );

        // Bổ sung tin nhắn thông báo tiến trình từ nhà hàng
        const statusMap: Record<string, string> = {
          confirmed: 'Đã được quán tiếp nhận',
          preparing: 'Bếp bắt đầu chế biến',
          ready: 'Đã nấu xong và sẵn sàng phục vụ',
          served: 'Đã phục vụ tại bàn',
          completed: 'Đã hoàn tất',
        };

        const statusText = statusMap[data.status] || data.status;
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            text: `🔔 **Cập nhật tiến trình:** Đơn hàng **#${data.orderCode}** vừa chuyển sang trạng thái: **${statusText}**.`,
          },
        ]);
      }
    }

    socket.on('order_status_updated', handleOrderStatusUpdate);
    socket.on('kds_item_updated', handleOrderStatusUpdate);

    return () => {
      socket.off('order_status_updated', handleOrderStatusUpdate);
      socket.off('kds_item_updated', handleOrderStatusUpdate);
    };
  }, [trackedOrderCodes]);

  // Gửi tin nhắn
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    if (!text || isLoading) return;

    setInput('');

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'customer',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await api.post('/chat/message', {
        message: text,
        conversationId,
        context: {
          customerPhone: user?.phone,
          user: user ? { id: user.id, fullName: user.fullName, phone: user.phone } : undefined,
        },
      });

      const data = res.data;
      const botMsg: ChatMessage = {
        id: data.id || `bot-${Date.now()}`,
        role: 'assistant',
        text: data.text || 'Dạ, Hương Sen đã ghi nhận thông tin ạ.',
        products: data.products,
        recommendations: data.recommendations,
        order: data.order,
        quickReplies: data.quickReplies,
        action: data.action,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      // Nếu có đơn hàng trả về, đưa vào danh sách theo dõi real-time
      if (data.order?.code && !trackedOrderCodes.includes(data.order.code)) {
        setTrackedOrderCodes((prev) => [...prev, data.order.code]);
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Mình đang gặp vấn đề khi kết nối với hệ thống nhà hàng. Bạn vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp hotline 0901.234.567 nhé!',
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Thêm 1 món vào giỏ hàng từ chat
  const handleAddToCart = (product: ChatProduct, quantity: number) => {
    addToCart(product, quantity, [], '');

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
    });

    setToastMessage(`Đã thêm ${quantity} phần "${product.name}" vào giỏ!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Thêm nhiều món vào giỏ hàng (áp dụng cho toàn bộ Phương án / Combo tư vấn)
  const handleAddMultipleToCart = (dishes: ChatProduct[], planTitle?: string) => {
    if (!dishes || dishes.length === 0) return;
    let count = 0;
    for (const dish of dishes) {
      if (dish.isAvailable) {
        addToCart(dish, 1, [], '');
        count++;
      }
    }
    if (count > 0) {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.8 },
      });
      setToastMessage(`Đã thêm ${count} món${planTitle ? ` (${planTitle})` : ''} vào giỏ hàng!`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Xem chi tiết món / điều hướng
  const handleViewDish = (product: ChatProduct) => {
    navigate(`/menu?search=${encodeURIComponent(product.name)}`);
  };

  // Xóa lịch sử hội thoại
  const handleClearChat = () => {
    if (window.confirm('Bạn muốn bắt đầu lại cuộc trò chuyện mới?')) {
      setMessages([]);
      sessionStorage.removeItem('rms_chat_messages');
      const newId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('rms_chat_conversation_id', newId);
      setConversationId(newId);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Khung tư vấn trực tuyến nhà hàng Hương Sen"
      className="fixed inset-x-3 bottom-3 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-auto sm:w-[410px] h-[580px] max-h-[90vh] bg-cream-50 rounded-3xl border border-wood-900/15 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
    >
      {/* 1. HEADER */}
      <div className="bg-lotus-900 text-cream-50 px-4 py-3.5 flex items-center justify-between border-b border-lotus-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-lotus-800 text-cream-100 flex items-center justify-center font-serif font-bold text-sm shadow-inner shrink-0">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-sm tracking-wider text-white">HƯƠNG SEN</h3>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Đang hoạt động</span>
              </span>
            </div>
            <p className="text-[10px] text-cream-200/80 font-light">Tư vấn món ăn & Hỗ trợ đặt bàn</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Làm mới cuộc trò chuyện"
              className="p-1.5 rounded-lg text-cream-200 hover:text-white hover:bg-lotus-800 transition"
              aria-label="Làm mới trò chuyện"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onMinimize}
            title="Thu nhỏ khung chat"
            className="p-1.5 rounded-lg text-cream-200 hover:text-white hover:bg-lotus-800 transition"
            aria-label="Thu nhỏ khung chat"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Đóng chatbox"
            className="p-1.5 rounded-lg text-cream-200 hover:text-white hover:bg-lotus-800 transition"
            aria-label="Đóng chatbox"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast notification banner */}
      {toastMessage && (
        <div className="bg-emerald-800 text-white text-xs px-3 py-2 flex items-center justify-between font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
          <span>{toastMessage}</span>
          <button
            onClick={() => setIsCartOpen(true)}
            className="text-[11px] underline font-bold hover:text-emerald-200"
          >
            Xem giỏ hàng
          </button>
        </div>
      )}

      {/* 2. CHAT MESSAGES BODY */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* Welcome Intro Screen */}
        {messages.length === 0 ? (
          <div className="space-y-4 pt-2">
            <div className="bg-white p-4 rounded-2xl border border-wood-200 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-lotus-900 font-serif font-bold text-sm">
                <Sparkles className="w-4 h-4 text-ochre-600" />
                <span>Kính chào quý thực khách!</span>
              </div>
              <p className="text-wood-700 text-xs leading-relaxed font-light">
                Hương Sen rất hân hạnh được đồng hành cùng bạn. Mình có thể hỗ trợ bạn xem thực đơn 118 món thuần Việt, gợi ý món ngon, đặt bàn trước hoặc tra cứu tiến trình chế biến.
              </p>
            </div>

            {/* Quick Starter Suggestions */}
            <div>
              <p className="text-[11px] font-bold text-wood-500 uppercase tracking-wider mb-2">
                Gợi ý câu hỏi phổ biến:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-cream-100 text-lotus-900 border border-wood-200 hover:border-lotus-400 text-xs font-medium transition shadow-xs text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Service Links */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-wood-200">
              <button
                onClick={() => navigate('/menu')}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-wood-200 hover:border-lotus-300 text-wood-800 hover:text-lotus-900 text-xs transition"
              >
                <UtensilsCrossed className="w-4 h-4 text-lotus-800 shrink-0" />
                <span className="font-medium truncate">Xem Thực Đơn</span>
              </button>
              <button
                onClick={() => navigate('/reserve')}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-wood-200 hover:border-lotus-300 text-wood-800 hover:text-lotus-900 text-xs transition"
              >
                <CalendarDays className="w-4 h-4 text-ochre-700 shrink-0" />
                <span className="font-medium truncate">Đặt Bàn Trước</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isCustomer = msg.role === 'customer';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isCustomer ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant Seal Avatar */}
                {!isCustomer && (
                  <div className="w-7 h-7 rounded-xl bg-lotus-800 text-white flex items-center justify-center font-serif font-bold text-xs shrink-0 shadow-xs mt-0.5">
                    S
                  </div>
                )}

                <div className={`space-y-2 max-w-[85%] ${isCustomer ? 'items-end' : 'items-start'}`}>
                  {/* Bubble */}
                  <div
                    className={`p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      isCustomer
                        ? 'bg-lotus-900 text-cream-50 rounded-br-xs shadow-xs font-normal'
                        : msg.isError
                        ? 'bg-terracotta/10 border border-terracotta/30 text-terracotta rounded-bl-xs'
                        : 'bg-white border border-wood-200 text-wood-900 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {/* Render plain text with Markdown-style bold and bullets */}
                    {msg.text.split('\n').map((line, lineIdx) => {
                      const isBullet = line.trim().startsWith('•');
                      // Parse bold text **xyz**
                      const parts = line.split(/(\*\*.*?\*\*)/g);

                      return (
                        <p key={lineIdx} className={`${isBullet ? 'pl-1 my-0.5' : 'my-0.5'}`}>
                          {parts.map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return (
                                <strong key={pIdx} className="font-bold text-lotus-950">
                                  {part.slice(2, -2)}
                                </strong>
                              );
                            }
                            return <span key={pIdx}>{part}</span>;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  {/* Render Recommendation Plans (Phương án 1, 2, 3) */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="space-y-3 pt-2">
                      {msg.recommendations.map((plan) => (
                        <div
                          key={plan.planId}
                          className="bg-white rounded-2xl border border-wood-200 shadow-xs p-3 space-y-2.5 transition hover:border-lotus-300"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-wood-100 pb-2">
                            <div>
                              <h4 className="font-serif font-bold text-xs text-lotus-900 leading-snug">
                                {plan.title}
                              </h4>
                              <p className="text-[10px] text-wood-500 font-light mt-0.5">
                                {plan.description}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold text-terracotta whitespace-nowrap bg-cream-100 px-2 py-0.5 rounded-lg shrink-0">
                              {plan.subtotal.toLocaleString('vi-VN')}đ
                            </span>
                          </div>

                          {/* Danh sách món trong phương án */}
                          <div className="space-y-1">
                            {plan.dishes.map((dish) => (
                              <div
                                key={dish.id}
                                className="flex items-center justify-between text-[11px] text-wood-800 bg-cream-50/70 px-2 py-1 rounded-lg"
                              >
                                <span className="truncate max-w-[190px] font-medium">• {dish.name}</span>
                                <span className="text-wood-600 font-serif">
                                  {(dish.discountedPrice || dish.price).toLocaleString('vi-VN')}đ
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Nút thao tác nhanh */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleAddMultipleToCart(plan.dishes, plan.title)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 text-xs font-semibold shadow-xs transition active:scale-98"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Thêm tất cả vào giỏ</span>
                            </button>
                            <button
                              onClick={() => handleSendMessage(`Tôi chọn ${plan.title.split(':')[0] || 'phương án này'}`)}
                              className="px-2.5 py-1.5 rounded-xl bg-cream-100 hover:bg-cream-200 text-lotus-900 border border-wood-200 text-[11px] font-medium transition"
                            >
                              Chọn
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Product Cards inside chat */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {msg.products.map((prod) => (
                        <ChatProductCard
                          key={prod.id}
                          product={prod}
                          onAddToCart={handleAddToCart}
                          onViewDetail={handleViewDish}
                        />
                      ))}
                    </div>
                  )}

                  {/* Render Order Card inside chat */}
                  {msg.order && (
                    <div className="pt-1">
                      <ChatOrderCard order={msg.order} />
                    </div>
                  )}

                  {/* Action Link CTA button if provided */}
                  {msg.action && (
                    <div className="pt-1">
                      {msg.action.type === 'view_menu' && (
                        <button
                          onClick={() => navigate(msg.action?.payload || '/menu')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lotus-800 text-cream-50 text-xs font-bold hover:bg-lotus-900 transition shadow-xs"
                        >
                          <UtensilsCrossed className="w-3.5 h-3.5" />
                          <span>Xem toàn bộ thực đơn</span>
                        </button>
                      )}
                      {msg.action.type === 'open_reserve' && (
                        <button
                          onClick={() => navigate(msg.action?.payload || '/reserve')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ochre-700 text-white text-xs font-bold hover:bg-ochre-800 transition shadow-xs"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Mở trang Đặt Bàn Ngay</span>
                        </button>
                      )}
                      {msg.action.type === 'add_to_cart' && (
                        <button
                          onClick={() => handleAddMultipleToCart(msg.action?.payload?.dishes || [], msg.action?.label)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-lotus-800 text-cream-50 text-xs font-bold hover:bg-lotus-900 transition shadow-xs active:scale-95"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{msg.action.label || 'Thêm tất cả vào giỏ'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Suggested Next Questions (Quick Replies) */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {msg.quickReplies.map((reply, rIdx) => (
                        <button
                          key={rIdx}
                          onClick={() => handleSendMessage(reply)}
                          className="px-2.5 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 text-lotus-900 border border-wood-200 text-[11px] font-medium transition"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  {msg.timestamp && (
                    <span className="text-[10px] text-wood-400 block px-1">
                      {msg.timestamp}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-wood-500 text-xs pl-9 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-lotus-800" />
            <span className="w-1.5 h-1.5 rounded-full bg-lotus-800" />
            <span className="w-1.5 h-1.5 rounded-full bg-lotus-800" />
            <span className="text-[11px] font-medium">Hương Sen đang xem thông tin...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. INPUT BAR */}
      <div className="p-3 bg-white border-t border-wood-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi món ăn, đặt bàn, đơn hàng..."
              disabled={isLoading}
              maxLength={400}
              className="w-full bg-cream-50 border border-wood-200 rounded-2xl pl-3 pr-8 py-2.5 text-xs text-wood-900 placeholder-wood-400 focus:outline-none focus:border-lotus-600 transition shadow-inner disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-2xl bg-lotus-800 hover:bg-lotus-900 text-cream-50 flex items-center justify-center transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-95"
            title="Gửi tin nhắn"
            aria-label="Gửi tin nhắn"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-wood-400 px-1">
          <span>Thông tin chính xác 100% từ nhà hàng</span>
          <span>Hotline: 0901.234.567</span>
        </div>
      </div>
    </div>
  );
};
