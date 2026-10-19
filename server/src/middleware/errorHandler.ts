import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, notFound } from '../domain/errors';

// Every error response has the shape { error: { code, message, details? } }.
// `code` (and each detail's `code`) is what clients translate for users;
// `message` is English text for developers and logs only.

const ERROR_CODE = /^[A-Z][A-Z0-9_]*$/;

/** Zod schemas use error codes as their messages (e.g. 'EMAIL_INVALID'); fall back for built-in checks. */
function issueCode(issue: ZodError['issues'][number]): string {
  if (ERROR_CODE.test(issue.message)) return issue.message;
  return issue.code === 'invalid_type' ? 'REQUIRED' : 'INVALID_VALUE';
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound('ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid.',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issueCode(issue),
        })),
      },
    });
    return;
  }

  // Unique constraint hit by a race the service-level check didn't catch.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({
      error: { code: 'ALREADY_EXISTS', message: 'A record with these details already exists.' },
    });
    return;
  }

  // Malformed JSON body (from express.json()).
  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
};
