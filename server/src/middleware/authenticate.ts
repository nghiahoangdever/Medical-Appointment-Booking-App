import type { Request, RequestHandler } from 'express';
import { unauthorized } from '../domain/errors';
import { authService } from '../modules/auth/auth.service';
import { verifyToken } from '../modules/auth/token';

/**
 * Requires a valid "Authorization: Bearer <jwt>" header and a still-active account, and sets
 * req.user. The account is re-read on every request, so deactivating a user (or changing their
 * role) takes effect immediately instead of when the token expires.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(unauthorized('NOT_AUTHENTICATED', 'Please log in to continue.'));
    return;
  }
  const { userId } = verifyToken(token);
  const user = await authService.getCurrentUser(userId); // 401 INVALID_TOKEN / 403 ACCOUNT_DISABLED
  req.user = { id: user.id, role: user.role };
  next();
};

/** The logged-in user; use only on routes behind `authenticate`. */
export function getAuthUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw unauthorized('NOT_AUTHENTICATED', 'Please log in to continue.');
  return req.user;
}
