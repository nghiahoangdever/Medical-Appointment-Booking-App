import { z } from 'zod';

// Load server/.env, except in tests where vitest.config.ts provides the env.
if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required (see server/.env.example)'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

export const config = envSchema.parse(process.env);
