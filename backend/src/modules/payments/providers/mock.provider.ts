import { env } from '../../../config/env.js';
import {
  PaymentProvider,
  CreatePaymentParams,
  PaymentOrderOutput,
  PaymentVerificationOutput,
  PaymentStatus,
} from '../payment.interface.js';

export class MockPaymentProvider implements PaymentProvider {
  readonly providerName = 'MOCK_HDFC';

  async createPaymentOrder(params: CreatePaymentParams): Promise<PaymentOrderOutput> {
    const providerOrderId = `MOCK_ORD_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const paymentUrl = `${env.FRONTEND_URL}/mock-payment?orderId=${providerOrderId}&amount=${params.amountPaisa / 100}`;

    return {
      providerOrderId,
      paymentUrl,
      expiresAt,
      rawResponse: { mock: true },
    };
  }

  async verifyWebhook(headers: Record<string, any>, body: any): Promise<PaymentVerificationOutput> {
    const isMockValid = headers['x-mock-signature'] !== 'invalid' && !body.invalidSignature;
    const orderId = body.providerOrderId || body.orderId;
    const txnId = body.providerTransactionId || `MOCK_TXN_${Date.now()}`;
    const status: PaymentStatus = body.status === 'FAILED' ? 'FAILED' : 'SUCCESS';

    return {
      isValid: isMockValid,
      providerOrderId: orderId,
      providerTransactionId: txnId,
      amountPaisa: body.amountPaisa || 10000,
      status,
      rawPayload: body,
    };
  }

  async getPaymentStatus(providerOrderId: string): Promise<PaymentVerificationOutput> {
    return {
      isValid: true,
      providerOrderId,
      providerTransactionId: `MOCK_TXN_RECON_${Date.now()}`,
      amountPaisa: 10000,
      status: 'SUCCESS',
      rawPayload: { simulated: true },
    };
  }

  async refundPayment(providerTransactionId: string, amountPaisa: number, reason: string): Promise<boolean> {
    return true;
  }
}
