import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../core/db.js';
import { requireAdminAuth, AuthRequest } from '../auth/auth.middleware.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';

const holidaysRouter = Router();

const holidaySchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(2, 'Reason is required'),
});

holidaysRouter.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, holiday_date AS "holidayDate", reason, created_at AS "createdAt"
      FROM clinic_holidays
      ORDER BY holiday_date ASC;
    `);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
  }
});

holidaysRouter.post('/', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.errors });
      return;
    }

    const resDb = await query(`
      INSERT INTO clinic_holidays (holiday_date, reason)
      VALUES ($1, $2)
      RETURNING id, holiday_date AS "holidayDate", reason, created_at AS "createdAt";
    `, [parsed.data.holidayDate, parsed.data.reason]);

    const holiday = resDb.rows[0];

    await recordAuditLog({
      adminUserId: req.user?.id,
      action: 'HOLIDAY_CREATED',
      entityType: 'ClinicHoliday',
      entityId: holiday.id,
      metadata: parsed.data,
    });

    res.status(201).json({ success: true, data: holiday });
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      res.status(400).json({ success: false, error: 'DUPLICATE_HOLIDAY', message: 'A holiday for this date already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
  }
});

holidaysRouter.delete('/:id', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const resDb = await query(`
      DELETE FROM clinic_holidays
      WHERE id = $1
      RETURNING id, holiday_date AS "holidayDate", reason;
    `, [id]);

    if (resDb.rows.length === 0) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Holiday not found' });
      return;
    }

    const deleted = resDb.rows[0];

    await recordAuditLog({
      adminUserId: req.user?.id,
      action: 'HOLIDAY_DELETED',
      entityType: 'ClinicHoliday',
      entityId: id,
      metadata: { deletedDate: deleted.holidayDate, reason: deleted.reason },
    });

    res.json({ success: true, message: 'Holiday removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
  }
});

export { holidaysRouter };
