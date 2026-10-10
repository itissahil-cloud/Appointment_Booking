import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { requireAdminAuth } from '../auth/auth.middleware.js';

const dashboardRouter = Router();

dashboardRouter.get('/', requireAdminAuth, DashboardController.getMetrics);

export { dashboardRouter };
