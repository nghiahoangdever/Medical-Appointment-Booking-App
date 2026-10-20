import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { ShiftController } from './shift.controller';
import { shiftService } from './shift.service';

const controller = new ShiftController(shiftService);

export const shiftRouter = Router();

shiftRouter.get('/', authenticate, controller.list);
