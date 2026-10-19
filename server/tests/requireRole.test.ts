import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '../src/domain/enums';
import { AppError } from '../src/domain/errors';
import { requireRole } from '../src/middleware/requireRole';

function run(user: Request['user'], ...roles: Role[]) {
  const next = vi.fn();
  requireRole(...roles)({ user } as Request, {} as Response, next);
  return next.mock.calls[0][0] as AppError | undefined;
}

describe('requireRole', () => {
  it('lets an allowed role through', () => {
    expect(run({ id: 1, role: Role.DOCTOR }, Role.DOCTOR, Role.ADMIN)).toBeUndefined();
  });

  it('rejects other roles with 403', () => {
    expect(run({ id: 1, role: Role.PATIENT }, Role.DOCTOR)?.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', () => {
    expect(run(undefined, Role.DOCTOR)?.status).toBe(401);
  });
});
