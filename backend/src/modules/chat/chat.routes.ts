import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ChatService } from './chat.service.js';
import { prisma } from '../../config/prisma.js';

const router = Router();

// Rate limiter dành riêng cho Chatbot (chống spam / flooding)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 30, // Tối đa 30 tin nhắn / phút / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng đợi trong giây lát nhé!',
  },
});

/**
 * 1. POST /api/chat/message
 * Nhận tin nhắn từ khách và trả về câu trả lời chuẩn xác từ database
 */
router.post('/message', chatLimiter, async (req: Request, res: Response) => {
  try {
    const { message, context, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Tin nhắn không hợp lệ.' });
    }

    // Sanitize input length
    const cleanMessage = message.trim().slice(0, 500);

    const mergedContext = {
      ...(context || {}),
      conversationId: conversationId || context?.conversationId,
    };

    const response = await ChatService.processMessage(cleanMessage, mergedContext);
    return res.json(response);
  } catch (error) {
    console.error('Chat processing error:', error);
    return res.status(500).json({
      message: 'Hương Sen đang gặp sự cố kết nối với dữ liệu. Bạn vui lòng thử lại sau ít phút nhé.',
    });
  }
});

/**
 * 2. GET /api/chat/quick-suggestions
 * Lấy các câu hỏi gợi ý nhanh dựa trên thực đơn và dịch vụ hiện hành
 */
router.get('/quick-suggestions', async (_req: Request, res: Response) => {
  try {
    const suggestions = [
      'Xem thực đơn',
      'Món nào được gọi nhiều?',
      'Tôi muốn đặt bàn',
      'Có món chay không?',
      'Có món ít cay không?',
      'Kiểm tra đơn hàng',
      'Nhà hàng mở cửa lúc mấy giờ?',
      'Địa chỉ nhà hàng ở đâu?',
    ];

    return res.json(suggestions);
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải gợi ý câu hỏi.' });
  }
});

/**
 * 3. GET /api/chat/restaurant-info
 * Lấy thông tin chính thức đã xác thực của nhà hàng
 */
router.get('/restaurant-info', async (_req: Request, res: Response) => {
  try {
    const branch = await prisma.branch.findFirst();

    return res.json({
      name: branch?.name || 'Nhà Hàng Ẩm Thực Hương Sen',
      address: branch?.address || 'Số 18 Đường Hoa Sen, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      phone: branch?.phone || '0901.234.567',
      openingHours: '10:00 - 22:30 (Thứ Hai - Chủ Nhật)',
      lastOrderTime: '21:45',
      paymentMethods: ['Tiền mặt', 'Quẹt thẻ POS', 'Chuyển khoản VietQR', 'Ví điện tử MoMo'],
      reservationPolicy: 'Giữ bàn trong 15 phút, đặt trước tối thiểu 1 tiếng',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải thông tin nhà hàng.' });
  }
});

export default router;
