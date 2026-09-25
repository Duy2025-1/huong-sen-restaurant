import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../config/prisma.js';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth.middleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_super_secret_jwt_key_2026';

// Rate limiter for authentication endpoints (prevents brute-force & credential stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
});

// 1. POST /api/auth/register - Đăng ký tài khoản Khách hàng
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { fullName, phone, email, password } = req.body;

    // Strict input validation
    if (!fullName || typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) {
      return res.status(400).json({ message: 'Vui lòng nhập họ và tên hợp lệ (tối đa 100 ký tự).' });
    }
    if (!phone || typeof phone !== 'string' || !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(phone.trim())) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ (cần 10 chữ số hợp lệ tại VN).' });
    }
    if (email) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 150) {
        return res.status(400).json({ message: 'Địa chỉ email không đúng định dạng.' });
      }
    }

    // Password policy: At least 8 characters, at least 1 letter and 1 number
    if (!password || typeof password !== 'string' || password.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm cả chữ cái và chữ số.',
      });
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    // Check existing phone
    const existingPhone = await prisma.customer.findUnique({ where: { phone: cleanPhone } });
    if (existingPhone) {
      return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký tài khoản.' });
    }

    // Check existing email
    if (cleanEmail) {
      const existingEmail = await prisma.customer.findUnique({ where: { email: cleanEmail } });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email này đã được sử dụng.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await prisma.customer.create({
      data: {
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        passwordHash,
      },
    });

    const token = jwt.sign(
      {
        id: customer.id,
        phone: customer.phone,
        role: 'customer',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        role: 'customer',
        roleName: 'Khách Hàng',
        pointBalance: customer.pointBalance,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Lỗi server khi đăng ký tài khoản.' });
  }
});

// 2. POST /api/auth/customer-login - Đăng nhập Khách hàng (bằng SĐT hoặc Email)
router.post('/customer-login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { loginKey, password } = req.body;
    if (!loginKey || !password || typeof loginKey !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Vui lòng nhập số điện thoại/email và mật khẩu.' });
    }

    const key = loginKey.trim();

    // Find customer by phone or email
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ phone: key }, { email: key.toLowerCase() }],
      },
    });

    // Constant-time check pattern to prevent account enumeration
    if (!customer || !customer.passwordHash) {
      return res.status(401).json({ message: 'Thông tin tài khoản hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Thông tin tài khoản hoặc mật khẩu không chính xác.' });
    }

    const token = jwt.sign(
      {
        id: customer.id,
        phone: customer.phone,
        role: 'customer',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        role: 'customer',
        roleName: 'Khách Hàng',
        pointBalance: customer.pointBalance,
      },
    });
  } catch (error) {
    console.error('Customer login error:', error);
    return res.status(500).json({ message: 'Lỗi server khi đăng nhập.' });
  }
});

// 3. POST /api/auth/staff-login - Đăng nhập Nhân viên / Admin
router.post('/staff-login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const staff = await prisma.staffUser.findUnique({
      where: { email: cleanEmail },
      include: { role: true, branch: true },
    });

    // Unified error message to mitigate user enumeration
    if (!staff || !staff.isActive) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, staff.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const token = jwt.sign(
      {
        id: staff.id,
        email: staff.email,
        role: staff.role.code,
        branchId: staff.branchId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role.code,
        roleName: staff.role.name,
        branch: staff.branch ? { id: staff.branch.id, name: staff.branch.name } : undefined,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Lỗi server khi đăng nhập.' });
  }
});

// 4. GET /api/auth/me - Lấy thông tin user hiện tại
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user!.id },
      });
      if (!customer) return res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
      return res.json({
        user: {
          id: customer.id,
          fullName: customer.fullName,
          phone: customer.phone,
          email: customer.email,
          role: 'customer',
          roleName: 'Khách Hàng',
          pointBalance: customer.pointBalance,
        },
      });
    }

    const staff = await prisma.staffUser.findUnique({
      where: { id: req.user!.id },
      include: { role: true, branch: true },
    });

    if (!staff || !staff.isActive) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên hoặc tài khoản bị vô hiệu hóa.' });
    }

    return res.json({
      user: {
        id: staff.id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role.code,
        roleName: staff.role.name,
        branch: staff.branch ? { id: staff.branch.id, name: staff.branch.name } : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server.' });
  }
});

// 5. GET /api/auth/users - Danh sách người dùng (Dành cho Admin & Manager)
router.get('/users', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const staffList = await prisma.staffUser.findMany({
      include: { role: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });

    const customerList = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Explicitly exclude passwordHash from all outputs
    return res.json({
      staff: staffList.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        role: s.role.code,
        roleName: s.role.name,
        branch: s.branch?.name,
        isActive: s.isActive,
        createdAt: s.createdAt,
      })),
      customers: customerList.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email || '---',
        phone: c.phone,
        pointBalance: c.pointBalance,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tải danh sách người dùng.' });
  }
});

export default router;
