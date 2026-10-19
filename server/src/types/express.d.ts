import type { Role } from '../domain/enums';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware from the JWT. */
      user?: { id: number; role: Role };
    }
  }
}

export {};
