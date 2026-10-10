import { Request, Response } from 'express';
import { QueueService } from './queue.service.js';
import { AuthRequest } from '../auth/auth.middleware.js';

export class QueueController {
  static async getTodayQueue(req: Request, res: Response): Promise<void> {
    try {
      const queue = await QueueService.getTodayQueue();
      res.json({ success: true, data: queue });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async callNext(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.id || 'system';
      const result = await QueueService.callNextPatient(adminUserId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }
}
