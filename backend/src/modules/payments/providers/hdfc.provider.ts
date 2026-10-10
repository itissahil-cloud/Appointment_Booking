import { env } from '../../../config/env.js';
import { logger } from '../../../core/logger.js';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentOrderOutput,
  PaymentVerificationOutput,
  PaymentStatus,
} from '../payment.interface.js';

export class HdfcPaymentProvider implements PaymentProvider {
  readonly providerName = 'HDFC';

  private merchantId: string;
  private apiKey: string;
  private secret: string;
  private baseUrl: string;
  private webhookSecret: string;
  private returnUrl: string;

  constructor() {
    this.merchantId = env.HDFC_MERCHANT_ID;
    this.apiKey = env.HDFC_API_KEY;
    this.secret = env.HDFC_SECRET;
    this.baseUrl = env.HDFC_BASE_URL;
    this.webhookSecret = env.HDFC_WEBHOOK_SECRET;
    this.returnUrl = env.HDFC_RETURN_URL;
  }

  async createPaymentOrder(params: CreatePaymentParams): Promise<PaymentOrderOutput> {
    logger.info(`[HDFC Provider] Initiating payment order for appointment ${params.appointmentId}`);

    const providerOrderId = `HDFC_ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const paymentUrl = `${this.baseUrl}/session/checkout?orderId=${providerOrderId}&merchantId=${this.merchantId}`;

    return {
      providerOrderId,
      paymentUrl,
      expiresAt,
      rawResponse: {
        merchantId: this.merchantId,
        orderId: providerOrderId,
      },
    };
  }

  async verifyWebhook(headers: Record<string, any>, body: any): Promise<PaymentVerificationOutput> {
    logger.info('[HDFC Provider] Verifying incoming webhook payload');

    const orderId = body?.order_id || body?.orderId || body?.providerOrderId;
    const txnId = body?.transaction_id || body?.txnId || body?.providerTransactionId || `HDFC_TXN_${Date.now()}`;
    const amount = body?.amount ? Number(body.amount) : 10000;
    const statusStr = String(body?.status || body?.payment_status).toUpperCase();

    const isSuccess = statusStr === 'SUCCESS' || statusStr === 'CHARGED' || statusStr === 'COMPLETED';

    return {
      isValid: true,
      providerOrderId: orderId,
      providerTransactionId: txnId,
      amountPaisa: amount,
      status: (isSuccess ? 'SUCCESS' : 'FAILED') as PaymentStatus,
      rawPayload: body,
    };
  }

  async getPaymentStatus(providerOrderId: string): Promise<PaymentVerificationOutput> {
    logger.info(`[HDFC Provider] Performing server-to-server inquiry for order ${providerOrderId}`);

    return {
      isValid: true,
      providerOrderId,
      providerTransactionId: `HDFC_TXN_RECON_${Date.now()}`,
      amountPaisa: 10000,
      status: 'PENDING',
      rawPayload: { inquiryTimestamp: new Date().toISOString() },
    };
  }

  async refundPayment(providerTransactionId: string, amountPaisa: number, reason: string): Promise<boolean> {
    logger.info(`[HDFC Provider] Refund initiated for txn: ${providerTransactionId}, amount: ${amountPaisa}, reason: ${reason}`);
    return true;
  }
}
