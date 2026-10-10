import { Request, Response } from 'express';
import { z } from 'zod';
import { SettingsService } from './settings.service.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';
import { AuthRequest } from '../auth/auth.middleware.js';

const updateSettingsSchema = z.object({
  clinicName: z.string().min(2).optional(),
  doctorName: z.string().min(2).optional(),
  bookingAmountPaisa: z.number().int().positive().optional(),
  dailyTokenLimit: z.number().int().min(1).max(200).optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  clinicOpenTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  clinicCloseTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  bookingOpenTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  cancellationCutoffHours: z.number().int().min(0).max(48).optional(),
  isBookingEnabled: z.boolean().optional(),
});

export class SettingsController {
  static async get(req: Request, res: Response): Promise<void> {
    try {
      const settings = await SettingsService.getSettings();
      const nextBookingDate = await SettingsService.getNextBookingDate();
      res.json({
        success: true,
        data: {
          settings,
          nextBookingDate: nextBookingDate.toISOString().split('T')[0],
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.errors });
        return;
      }

      const updated = await SettingsService.updateSettings(parsed.data);

      await recordAuditLog({
        adminUserId: req.user?.id,
        action: 'SETTINGS_UPDATED',
        entityType: 'ClinicSetting',
        entityId: updated.id,
        metadata: parsed.data,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }
}
