import { Router } from 'express';
import { WhatsAppController } from './whatsapp.controller.js';

const whatsappRouter = Router();

whatsappRouter.get('/', WhatsAppController.verifyWebhook);
whatsappRouter.post('/', WhatsAppController.handleWebhook);

export { whatsappRouter };
