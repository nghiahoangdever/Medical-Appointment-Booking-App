import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../../config';
import { Role } from '../../domain/enums';
import { unauthorized } from '../../domain/errors';

export interface TokenPayload {
  userId: number;
  role: Role;
}

export function signToken({ userId, role }: TokenPayload): string {
  return jwt.sign({ role }, config.JWT_SECRET, {
    subject: String(userId),
    expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('Malformed token');
    const role = decoded.role as Role;
    if (!Object.values(Role).includes(role)) throw new Error('Unknown role');
    return { userId: Number(decoded.sub), role };
  } catch {
    throw unauthorized(
      'INVALID_TOKEN',
      'Your session is invalid or has expired. Please log in again.',
    );
  }
}
