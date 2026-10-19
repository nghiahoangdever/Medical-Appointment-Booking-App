import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { SpecialtyController } from './specialty.controller';
import { specialtyService } from './specialty.service';

const controller = new SpecialtyController(specialtyService);

export const specialtyRouter = Router();

specialtyRouter.use(authenticate);
specialtyRouter.get('/', controller.list);
specialtyRouter.get('/:id/doctors', controller.listDoctors);
