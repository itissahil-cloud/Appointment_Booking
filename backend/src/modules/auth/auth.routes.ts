import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { requireAdminAuth } from './auth.middleware.js';

const authRouter = Router();

// Strict rate-limiting on login to prevent brute-force attacks (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 mins window
  message: { success: false, error: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post('/login', loginLimiter, AuthController.login);
authRouter.post('/logout', requireAdminAuth, AuthController.logout);
authRouter.get('/me', requireAdminAuth, AuthController.me);

export { authRouter };
