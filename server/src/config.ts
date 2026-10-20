import { z } from 'zod';

// Load server/.env, except in tests where vitest.config.ts provides the env.
if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required (see server/.env.example)'),
    JWT_EXPIRES_IN: z.string().default('8h'),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    /** Dev only: pretend it is this time ("HH:mm") today. See src/clock.ts. */
    DEV_FAKE_NOW: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'DEV_FAKE_NOW must be "HH:mm", e.g. "09:00"')
        .optional(),
    ),
  })
  .refine((env) => !(env.DEV_FAKE_NOW && env.NODE_ENV === 'production'), {
    message: 'DEV_FAKE_NOW must not be set in production',
  });

export const config = envSchema.parse(process.env);
