import { Router, Response } from 'express';
import { query } from '../../core/db.js';
import { requireAdminAuth, AuthRequest } from '../auth/auth.middleware.js';

const auditRouter = Router();

auditRouter.get('/', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const offset = (page - 1) * limit;

    const [countRes, dataRes] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM audit_logs;`),
      query(`
        SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
               a.metadata, a.ip_address AS "ipAddress", a.created_at AS "createdAt",
               u.full_name AS "adminName", u.email AS "adminEmail"
        FROM audit_logs a
        LEFT JOIN admin_users u ON u.id = a.admin_user_id
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2;
      `, [limit, offset]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);
    const data = dataRes.rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
      adminUser: r.adminName ? { fullName: r.adminName, email: r.adminEmail } : null,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
  }
});

export { auditRouter };
