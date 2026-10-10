import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { AuthRequest } from './auth.middleware.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password is required'),
});

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.errors });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const result = await AuthService.login(parsed.data.email, parsed.data.password, clientIp);

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('clinic_session', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
        },
      });
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') {
        res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
    }
  }

  static async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (req.user) {
        const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        await AuthService.logout(req.user.id, clientIp);
      }
      res.clearCookie('clinic_session');
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to log out' });
    }
  }

  static async me(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: { user: req.user } });
  }
}
