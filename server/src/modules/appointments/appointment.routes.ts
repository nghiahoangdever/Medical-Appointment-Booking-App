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
appointmentRouter.post('/', requireRole(Role.PATIENT), controller.book);
appointmentRouter.get('/mine', requireRole(Role.PATIENT), controller.listMine);
appointmentRouter.post(
  '/:id/cancel',
  requireRole(Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN),
  controller.cancel,
);
