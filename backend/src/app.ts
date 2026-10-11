import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './core/logger.js';

// Route imports
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { queueRouter } from './modules/queue/queue.routes.js';
import { patientRouter } from './modules/patients/patient.routes.js';
import { appointmentRouter } from './modules/appointments/appointment.routes.js';
import { paymentRouter } from './modules/payments/payment.routes.js';
import { settingsRouter } from './modules/clinic-settings/settings.routes.js';
import { holidaysRouter } from './modules/holidays/holidays.routes.js';
import { auditRouter } from './modules/audit-logs/audit.routes.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes.js';
import { PaymentController } from './modules/payments/payment.controller.js';

export const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: [
      env.FRONTEND_URL,
      'https://drskpoddar.in',
      'https://www.drskpoddar.in',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());

// Structured HTTP Access Logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info(`HTTP ${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`);
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/queue', queueRouter);
app.use('/api/patients', patientRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/audit-logs', auditRouter);

// Webhook Endpoints
app.use('/api/webhooks/whatsapp', whatsappRouter);
app.post('/api/webhooks/payment/hdfc', PaymentController.handleWebhook);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Application Error', { error: err.message, stack: err.stack });
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    success: false,
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    ...(isDev ? { stack: err.stack } : {}),
  });
});
