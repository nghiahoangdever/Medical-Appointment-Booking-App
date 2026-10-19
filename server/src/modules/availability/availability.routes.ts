import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { AvailabilityController } from './availability.controller';
import { availabilityService } from './availability.service';

const controller = new AvailabilityController(availabilityService);

export const availabilityRouter = Router();

availabilityRouter.get('/', authenticate, controller.get);
