import { Router } from 'express';
import { Role } from '../../domain/enums';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { AppointmentController } from './appointment.controller';
import { appointmentService } from './appointment.service';
import { bookingService } from './booking.service';

const controller = new AppointmentController(bookingService, appointmentService);

export const appointmentRouter = Router();

appointmentRouter.use(authenticate);

// Patient
appointmentRouter.post('/', requireRole(Role.PATIENT), controller.book);
appointmentRouter.get('/mine', requireRole(Role.PATIENT), controller.listMine);

// Staff list and search
appointmentRouter.get('/', requireRole(Role.RECEPTIONIST, Role.ADMIN), controller.listForStaff);

// One endpoint per state-machine action
appointmentRouter.post(
  '/:id/cancel',
  requireRole(Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN),
  controller.cancel,
);
appointmentRouter.post('/:id/check-in', requireRole(Role.RECEPTIONIST), controller.checkIn);
// DOCTOR joins in Phase 4, together with the "doctor owns the roster entry" guard.
appointmentRouter.post('/:id/no-show', requireRole(Role.RECEPTIONIST), controller.markNoShow);

// Notes (DOCTOR joins in Phase 4)
appointmentRouter.post('/:id/notes', requireRole(Role.RECEPTIONIST), controller.addNote);
