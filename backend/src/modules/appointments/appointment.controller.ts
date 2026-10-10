import { Request, Response } from 'express';
import { AppointmentService } from './appointment.service.js';
import { AuthRequest } from '../auth/auth.middleware.js';
import { AppointmentStatus } from '../payments/payment.interface.js';

export class AppointmentController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { date, status, search, page, limit } = req.query;
      const result = await AppointmentService.listAppointments({
        date: date as string,
        status: status as AppointmentStatus,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const appt = await AppointmentService.getAppointmentById(id);
      if (!appt) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Appointment not found' });
        return;
      }
      res.json({ success: true, data: appt });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async markInProgress(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await AppointmentService.updateStatus(id, 'IN_PROGRESS', req.user?.id || 'system');
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async markCompleted(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await AppointmentService.updateStatus(id, 'COMPLETED', req.user?.id || 'system');
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async markNoShow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await AppointmentService.updateStatus(id, 'NO_SHOW', req.user?.id || 'system');
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async cancel(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updated = await AppointmentService.updateStatus(id, 'CANCELLED', req.user?.id || 'system', reason);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }
}
