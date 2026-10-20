// Reusable zod building blocks for controllers.
// Convention: every custom message is an error code (UPPER_SNAKE_CASE) that clients translate.

import { z } from 'zod';
import { isValidDateString } from './domain/time';

/** A real calendar date in "YYYY-MM-DD" form. */
export const dateString = () =>
  z
    .string({ error: 'DATE_INVALID' })
    .refine(isValidDateString, { error: 'DATE_INVALID', abort: true });

/** A time of day in "HH:mm" form (00:00–23:59). */
export const timeOfDay = () =>
  z.string({ error: 'TIME_INVALID' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'TIME_INVALID');

/** A positive integer id, accepting strings such as route params and query values. */
export const id = () =>
  z.coerce.number({ error: 'ID_INVALID' }).int('ID_INVALID').positive('ID_INVALID');

/** Free text that may be cleared: blank becomes null. */
export const nullableText = (max: number, tooLongCode: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongCode)
    .transform((s) => s || null);

/** Optional free text; blank becomes undefined. */
export const optionalText = (max: number, tooLongCode: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongCode)
    .optional()
    .transform((s) => s || undefined);

// Account fields, shared by patient registration and staff accounts.
export const fullName = () => z.string().trim().min(2, 'NAME_REQUIRED').max(100, 'NAME_TOO_LONG');
export const email = () => z.string().trim().toLowerCase().pipe(z.email('EMAIL_INVALID'));
export const phone = () =>
  z
    .string()
    .trim()
    .regex(/^\+?\d{9,15}$/, 'PHONE_INVALID');
export const password = () => z.string().min(8, 'PASSWORD_TOO_SHORT').max(72, 'PASSWORD_TOO_LONG');
