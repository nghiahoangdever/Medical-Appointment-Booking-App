import { Router } from 'express';
import { Role } from '../../domain/enums';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { QueueController } from './queue.controller';
import { queueService } from './queue.service';

const controller = new QueueController(queueService);
const doctorOnly = [authenticate, requireRole(Role.DOCTOR)];

// Mounted at /api. Middleware is attached per route (not router.use) so unknown /api paths
// still reach the 404 handler instead of being rejected as unauthenticated.
export const queueRouter = Router();

queueRouter.get('/doctor/schedule', ...doctorOnly, controller.schedule);
queueRouter.get('/roster-entries/:id/queue', ...doctorOnly, controller.queueForEntry);
queueRouter.post('/roster-entries/:id/call-next', ...doctorOnly, controller.callNext);
