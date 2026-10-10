import { Request, Response } from 'express';
import { z } from 'zod';
import { PatientService } from './patient.service.js';
import { AuthRequest } from '../auth/auth.middleware.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';

const noteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty'),
});

export class PatientController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;

      const result = await PatientService.listPatients({ search, page, limit });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const patient = await PatientService.getPatientById(id);
      if (!patient) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Patient not found' });
        return;
      }
      res.json({ success: true, data: patient });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async addNote(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = noteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.errors });
        return;
      }

      if (!req.user) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        return;
      }

      const note = await PatientService.addDoctorNote(id, req.user.id, parsed.data.note);

      await recordAuditLog({
        adminUserId: req.user.id,
        action: 'PATIENT_NOTE_ADDED',
        entityType: 'PatientNote',
        entityId: note.id,
        metadata: { patientId: id },
      });

      res.status(201).json({ success: true, data: note });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }
}
