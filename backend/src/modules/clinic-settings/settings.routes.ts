import { Router } from 'express';
import { SettingsController } from './settings.controller.js';
import { requireAdminAuth } from '../auth/auth.middleware.js';

const settingsRouter = Router();

settingsRouter.get('/', SettingsController.get);
settingsRouter.patch('/', requireAdminAuth, SettingsController.update);

export { settingsRouter };
