import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './modules/auth/auth.routes.js';
import tablesRoutes from './modules/tables/tables.routes.js';
import menuRoutes from './modules/menu/menu.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import kdsRoutes from './modules/kds/kds.routes.js';
import reservationsRoutes from './modules/reservations/reservations.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';

import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';

export function createApp() {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // API endpoints return JSON
    })
  );

  // 2. Hide X-Powered-By to prevent technology fingerprinting
  app.disable('x-powered-by');

  // 3. CORS Configuration
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error('Chính sách CORS không cho phép truy cập từ nguồn này.'));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // 4. Request body size limit to prevent Denial of Service via large payloads
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5. Global API Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1500, // Max requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều yêu cầu đến hệ thống. Vui lòng thử lại sau.' },
  });
  app.use('/api', globalLimiter);

  // 6. Health check route
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      time: new Date().toISOString(),
      service: 'Restaurant Management System API',
    });
  });

  // 7. Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/tables', tablesRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/kds', kdsRoutes);
  app.use('/api/reservations', reservationsRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/chat', chatRoutes);

  // 8. 404 Route Handler
  app.use((req, res) => {
    res.status(404).json({ message: 'Tài nguyên hoặc endpoint không tồn tại.' });
  });

  // 9. Centralized Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Application Error:', err.message || err);
    const statusCode = err.status || (err.name === 'UnauthorizedError' ? 401 : 500);
    const isDev = process.env.NODE_ENV === 'development';

    res.status(statusCode).json({
      message: err.message || 'Đã xảy ra lỗi nội bộ máy chủ.',
      ...(isDev && { error: err.stack }),
    });
  });

  return app;
}
