import { query } from '../../core/db.js';
import { logger } from '../../core/logger.js';

export interface RecordAuditParams {
  adminUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, metadata, ip_address)
      VALUES ($1, $2::audit_action, $3, $4, $5, $6);
    `, [
      params.adminUserId || null,
      params.action,
      params.entityType,
      params.entityId || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.ipAddress || null,
    ]);
    logger.info(`Audit log recorded: ${params.action} on ${params.entityType}:${params.entityId || 'none'}`);
  } catch (error) {
    logger.error('Failed to write audit log', { error, params });
  }
}
