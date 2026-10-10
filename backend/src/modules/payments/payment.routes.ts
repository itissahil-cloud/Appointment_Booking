import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { requireAdminAuth } from '../auth/auth.middleware.js';

const paymentRouter = Router();

// Webhook endpoint
paymentRouter.post('/webhook', PaymentController.handleWebhook);

// Admin endpoints
paymentRouter.get('/', requireAdminAuth, PaymentController.list);
paymentRouter.get('/:id', requireAdminAuth, PaymentController.getById);
paymentRouter.post('/:id/reconcile', requireAdminAuth, PaymentController.reconcile);

// Mock payment simulation endpoint (active during dev/mock)
paymentRouter.post('/mock/pay', PaymentController.mockSimulatePayment);

export { paymentRouter };
