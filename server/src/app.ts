import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { appointmentRouter } from './modules/appointments/appointment.routes';
import { authRouter } from './modules/auth/auth.routes';
import { availabilityRouter } from './modules/availability/availability.routes';
import { specialtyRouter } from './modules/specialties/specialty.routes';

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/specialties', specialtyRouter);
  app.use('/api/availability', availabilityRouter);
  app.use('/api/appointments', appointmentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
