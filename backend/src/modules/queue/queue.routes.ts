import { Router } from 'express';
import { QueueController } from './queue.controller.js';
import { requireAdminAuth } from '../auth/auth.middleware.js';

const queueRouter = Router();

queueRouter.get('/today', requireAdminAuth, QueueController.getTodayQueue);
queueRouter.post('/next', requireAdminAuth, QueueController.callNext);

export { queueRouter };
