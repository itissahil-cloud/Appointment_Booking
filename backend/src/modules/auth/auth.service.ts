import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../core/db.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';

export class AuthService {
  static async login(email: string, plainPassword: string, ipAddress?: string) {
    const res = await query(`
      SELECT id, email, password_hash, full_name, role, is_active
      FROM admin_users
      WHERE email = $1;
    `, [email.toLowerCase().trim()]);

    const admin = res.rows[0];

    if (!admin || !admin.is_active) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(plainPassword, admin.password_hash);
    if (!isMatch) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await recordAuditLog({
      adminUserId: admin.id,
      action: 'ADMIN_LOGIN',
      entityType: 'AdminUser',
      entityId: admin.id,
      ipAddress,
    });

    return {
      token,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
      },
    };
  }

  static async logout(adminUserId: string, ipAddress?: string) {
    await recordAuditLog({
      adminUserId,
      action: 'ADMIN_LOGOUT',
      entityType: 'AdminUser',
      entityId: adminUserId,
      ipAddress,
    });
  }
}
