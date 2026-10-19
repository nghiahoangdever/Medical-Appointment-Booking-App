import type { RequestHandler } from 'express';
import type { Role } from '../domain/enums';
import { forbidden, unauthorized } from '../domain/errors';

/** Allows the request through only if req.user has one of `roles`. Use after `authenticate`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(unauthorized('NOT_AUTHENTICATED', 'Please log in to continue.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('FORBIDDEN', 'You do not have permission to do this.'));
      return;
    }
    next();
  };
}
