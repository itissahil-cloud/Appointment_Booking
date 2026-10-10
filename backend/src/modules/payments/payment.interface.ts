export type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'CANCELLED';

export type AppointmentStatus =
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

export interface CreatePaymentParams {
  appointmentId: string;
  patientId: string;
  amountPaisa: number;
  currency: 'INR';
  patientName: string;
  patientPhone: string;
  returnUrl?: string;
}

export interface PaymentOrderOutput {
  providerOrderId: string;
  paymentUrl: string;
  expiresAt: Date;
  rawResponse?: any;
}

export interface PaymentVerificationOutput {
  isValid: boolean;
  providerOrderId: string;
  providerTransactionId: string;
  amountPaisa: number;
  status: PaymentStatus;
  rawPayload: any;
}

export interface PaymentProvider {
  readonly providerName: string;

  /**
   * Creates an order/session with the payment gateway and returns checkout URL.
   */
  createPaymentOrder(params: CreatePaymentParams): Promise<PaymentOrderOutput>;

  /**
   * Verifies the authenticity and signature of incoming webhook callbacks.
   */
  verifyWebhook(headers: Record<string, any>, body: any): Promise<PaymentVerificationOutput>;

  /**
   * Server-to-server inquiry to fetch payment status for pending order reconciliation.
   */
  getPaymentStatus(providerOrderId: string): Promise<PaymentVerificationOutput>;

  /**
   * Process refund if requested and supported.
   */
  refundPayment?(providerTransactionId: string, amountPaisa: number, reason: string): Promise<boolean>;
}
