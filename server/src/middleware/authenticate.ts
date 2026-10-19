import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../domain/errors';
import { verifyToken } from '../modules/auth/token';

/** Requires a valid "Authorization: Bearer <jwt>" header and sets req.user. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(unauthorized('NOT_AUTHENTICATED', 'Please log in to continue.'));
    return;
  }
  const { userId, role } = verifyToken(token);
  req.user = { id: userId, role };
  next();
};

/** The logged-in user; use only on routes behind `authenticate`. */
export function getAuthUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw unauthorized('NOT_AUTHENTICATED', 'Please log in to continue.');
  return req.user;
}
