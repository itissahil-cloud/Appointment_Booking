import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service.js';

export class DashboardController {
  static async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await DashboardService.getDashboardMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }
}
