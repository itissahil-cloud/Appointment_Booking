import { Request, Response } from 'express';
import { query } from '../../core/db.js';
import { logger } from '../../core/logger.js';
import { PaymentService } from './payment.service.js';
import { AuthRequest } from '../auth/auth.middleware.js';
import { recordAuditLog } from '../audit-logs/audit.service.js';

export class PaymentController {
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Received payment webhook notification', { body: req.body });
      const result = await PaymentService.handleWebhook(req.headers, req.body);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error handling payment webhook', { error: error.message });
      if (error.message === 'INVALID_WEBHOOK_SIGNATURE') {
        res.status(401).json({ success: false, error: 'INVALID_SIGNATURE' });
        return;
      }
      res.status(400).json({ success: false, error: error.message || 'WEBHOOK_PROCESSING_FAILED' });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = (page - 1) * limit;

      const search = req.query.search as string;

      let countSql = `SELECT COUNT(*) AS total FROM payments p JOIN patients pt ON pt.id = p.patient_id`;
      let dataSql = `
        SELECT p.id, p.amount_paisa AS "amountPaisa", p.currency, p.status, p.provider,
               p.provider_order_id AS "providerOrderId", p.provider_transaction_id AS "providerTransactionId",
               p.payment_url AS "paymentUrl", p.verified_at AS "verifiedAt", p.created_at AS "createdAt",
               pt.full_name AS "patientName", pt.phone_number AS "patientPhone",
               a.token_number AS "tokenNumber", a.appointment_date AS "appointmentDate", a.status AS "appointmentStatus"
        FROM payments p
        JOIN patients pt ON pt.id = p.patient_id
        LEFT JOIN appointments a ON a.id = p.appointment_id
      `;
      const params: any[] = [];

      if (search) {
        countSql += ` WHERE p.provider_order_id ILIKE $1 OR p.provider_transaction_id ILIKE $1 OR pt.full_name ILIKE $1 OR pt.phone_number LIKE $1`;
        dataSql += ` WHERE p.provider_order_id ILIKE $1 OR p.provider_transaction_id ILIKE $1 OR pt.full_name ILIKE $1 OR pt.phone_number LIKE $1`;
        params.push(`%${search}%`);
      }

      dataSql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

      const [countRes, dataRes] = await Promise.all([
        query(countSql, search ? [`%${search}%`] : []),
        query(dataSql, [...params, limit, offset]),
      ]);

      const total = parseInt(countRes.rows[0].total, 10);
      const formatted = dataRes.rows.map((r) => ({
        ...r,
        patient: { fullName: r.patientName, phoneNumber: r.patientPhone },
        appointment: { tokenNumber: r.tokenNumber, appointmentDate: r.appointmentDate, status: r.appointmentStatus },
      }));

      res.json({
        success: true,
        data: formatted,
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
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resDb = await query(`
        SELECT p.*, pt.full_name AS "patientName", pt.phone_number AS "patientPhone"
        FROM payments p
        JOIN patients pt ON pt.id = p.patient_id
        WHERE p.id = $1;
      `, [id]);

      if (resDb.rows.length === 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Payment record not found' });
        return;
      }

      res.json({ success: true, data: resDb.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
    }
  }

  static async reconcile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await PaymentService.reconcilePayment(id);

      await recordAuditLog({
        adminUserId: req.user?.id,
        action: 'MANUAL_RECONCILIATION',
        entityType: 'Payment',
        entityId: id,
        metadata: { reconciliationResult: result },
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'RECONCILIATION_FAILED', message: error.message });
    }
  }

  static async mockSimulatePayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, status = 'SUCCESS' } = req.body;
      const result = await PaymentService.handleWebhook(
        { 'x-mock-signature': 'valid' },
        {
          providerOrderId: orderId,
          providerTransactionId: `SIM_TXN_${Date.now()}`,
          status,
          amountPaisa: 10000,
        }
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
