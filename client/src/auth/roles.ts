import type { Role } from '../types';

/** Landing page for each role after login. */
export const ROLE_HOME: Record<Role, string> = {
  PATIENT: '/patient',
  RECEPTIONIST: '/reception',
  DOCTOR: '/doctor',
  ADMIN: '/admin/roster',
};
