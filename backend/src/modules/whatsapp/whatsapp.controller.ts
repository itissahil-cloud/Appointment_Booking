import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../core/logger.js';
import { WhatsAppConversationStateMachine } from './conversation.state-machine.js';

export class WhatsAppController {
  /**
   * Meta Webhook Verification (GET /api/webhooks/whatsapp)
   */
  static verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Meta WhatsApp webhook verification challenge succeeded');
      res.status(200).send(challenge);
    } else {
      logger.warn('Meta WhatsApp webhook verification failed: Invalid verify token');
      res.status(403).send('Forbidden');
    }
  }

  /**
   * Meta Webhook Event Ingestion (POST /api/webhooks/whatsapp)
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // 1. Signature Verification (Meta X-Hub-Signature-256)
      const signatureHeader = req.headers['x-hub-signature-256'] as string;
      if (!env.USE_MOCK_WHATSAPP && env.WHATSAPP_APP_SECRET && signatureHeader) {
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        const expectedSignature = `sha256=${crypto
          .createHmac('sha256', env.WHATSAPP_APP_SECRET)
          .update(rawBody)
          .digest('hex')}`;

        if (signatureHeader !== expectedSignature) {
          logger.warn('Meta WhatsApp webhook signature mismatch');
          res.status(401).send('Unauthorized');
          return;
        }
      }

      // Return 200 OK immediately to Meta to acknowledge receipt
      res.status(200).json({ status: 'EVENT_RECEIVED' });

      // 2. Parse Meta Webhook Payload
      const body = req.body;
      if (!body.entry || !Array.isArray(body.entry)) return;

      for (const entry of body.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value;
          if (!value || !value.messages || !Array.isArray(value.messages)) continue;

          for (const message of value.messages) {
            const from = message.from; // Phone number without +
            const messageId = message.id;

            logger.info(`Incoming WhatsApp event from ${from}, type: ${message.type}, id: ${messageId}`);

            if (message.type === 'text') {
              await WhatsAppConversationStateMachine.handleIncomingMessage({
                fromPhone: from,
                messageType: 'text',
                text: message.text?.body,
                messageId,
              });
            } else if (message.type === 'interactive') {
              const interactive = message.interactive;
              if (interactive.type === 'button_reply') {
                await WhatsAppConversationStateMachine.handleIncomingMessage({
                  fromPhone: from,
                  messageType: 'button_reply',
                  buttonId: interactive.button_reply?.id,
                  text: interactive.button_reply?.title,
                  messageId,
                });
              }
            } else if (message.type === 'button') {
              await WhatsAppConversationStateMachine.handleIncomingMessage({
                fromPhone: from,
                messageType: 'button_reply',
                buttonId: message.button?.payload,
                text: message.button?.text,
                messageId,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing WhatsApp webhook event', { error });
    }
  }
}
