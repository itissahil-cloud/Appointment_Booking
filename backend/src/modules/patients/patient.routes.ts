import { Router } from 'express';
import { PatientController } from './patient.controller.js';
import { requireAdminAuth } from '../auth/auth.middleware.js';

const patientRouter = Router();

patientRouter.get('/', requireAdminAuth, PatientController.list);
patientRouter.get('/:id', requireAdminAuth, PatientController.getById);
patientRouter.post('/:id/notes', requireAdminAuth, PatientController.addNote);

export { patientRouter };
