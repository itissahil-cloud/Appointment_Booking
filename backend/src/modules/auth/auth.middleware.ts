import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../core/db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAdminAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.clinic_session || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email: string };
    const result = await query(`
      SELECT id, email, full_name, role, is_active
      FROM admin_users
      WHERE id = $1;
    `, [decoded.sub]);

    const admin = result.rows[0];

    if (!admin || !admin.is_active) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Invalid or deactivated user session' });
      return;
    }

    req.user = {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
    };
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Session expired or invalid' });
  }
}
