// Reusable zod building blocks for controllers.
// Convention: every custom message is an error code (UPPER_SNAKE_CASE) that clients translate.

import { z } from 'zod';
import { isValidDateString } from './domain/time';

/** A real calendar date in "YYYY-MM-DD" form. */
export const dateString = () =>
  z
    .string({ error: 'DATE_INVALID' })
    .refine(isValidDateString, { error: 'DATE_INVALID', abort: true });

/** A positive integer id, accepting strings such as route params and query values. */
export const id = () =>
  z.coerce.number({ error: 'ID_INVALID' }).int('ID_INVALID').positive('ID_INVALID');
