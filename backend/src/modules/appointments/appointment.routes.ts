import { Router } from 'express';
import { AppointmentController } from './appointment.controller.js';
import { requireAdminAuth } from '../auth/auth.middleware.js';

const appointmentRouter = Router();

appointmentRouter.get('/', requireAdminAuth, AppointmentController.list);
appointmentRouter.get('/:id', requireAdminAuth, AppointmentController.getById);
appointmentRouter.post('/:id/in-progress', requireAdminAuth, AppointmentController.markInProgress);
appointmentRouter.post('/:id/complete', requireAdminAuth, AppointmentController.markCompleted);
appointmentRouter.post('/:id/no-show', requireAdminAuth, AppointmentController.markNoShow);
appointmentRouter.post('/:id/cancel', requireAdminAuth, AppointmentController.cancel);

export { appointmentRouter };
