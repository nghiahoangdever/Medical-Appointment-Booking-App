import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { AuthController } from './auth.controller';
import { authService } from './auth.service';

const controller = new AuthController(authService);

export const authRouter = Router();

authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);
authRouter.get('/me', authenticate, controller.me);
