// The appointment state diagram as data. Each row is one transition (an arrow in the diagram):
// which action moves an appointment from which status to which, and which roles may trigger it.
// Services never assign `status` directly; they ask `transition()` for the next status.
//
// Time-based guards (e.g. "patient may cancel only before the shift starts") need the clock
// and the roster, so the services check those; this file covers status + role only.

import { AppointmentStatus as S, Role, type AppointmentStatus } from './enums';
import { conflict, forbidden } from './errors';

export const AppointmentAction = {
  CANCEL: 'CANCEL',
  CHECK_IN: 'CHECK_IN',
  START: 'START',
  COMPLETE: 'COMPLETE',
  MARK_NO_SHOW: 'MARK_NO_SHOW',
} as const;
export type AppointmentAction = (typeof AppointmentAction)[keyof typeof AppointmentAction];

const A = AppointmentAction;

/** Booking creates an appointment in this status (the diagram's initial transition). */
export const INITIAL_STATUS: AppointmentStatus = S.BOOKED;

export interface Transition {
  action: AppointmentAction;
  from: AppointmentStatus;
  to: AppointmentStatus;
  roles: readonly Role[];
}

export const TRANSITIONS: readonly Transition[] = [
  {
    action: A.CANCEL,
    from: S.BOOKED,
    to: S.CANCELLED,
    roles: [Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN],
  },
  { action: A.CHECK_IN, from: S.BOOKED, to: S.CHECKED_IN, roles: [Role.RECEPTIONIST] },
  {
    action: A.MARK_NO_SHOW,
    from: S.BOOKED,
    to: S.NO_SHOW,
    roles: [Role.RECEPTIONIST, Role.DOCTOR],
  },
  { action: A.START, from: S.CHECKED_IN, to: S.IN_EXAMINATION, roles: [Role.DOCTOR] },
  { action: A.MARK_NO_SHOW, from: S.CHECKED_IN, to: S.NO_SHOW, roles: [Role.DOCTOR] },
  { action: A.COMPLETE, from: S.IN_EXAMINATION, to: S.COMPLETED, roles: [Role.DOCTOR] },
];

export const FINAL_STATUSES: readonly AppointmentStatus[] = [S.COMPLETED, S.CANCELLED, S.NO_SHOW];

/**
 * Returns the status `action` leads to from `current` when performed by `role`.
 * @throws 409 INVALID_STATUS_TRANSITION if the diagram has no such arrow from `current`
 * @throws 403 ACTION_NOT_ALLOWED_FOR_ROLE if the arrow exists but `role` may not trigger it
 */
export function transition(
  current: AppointmentStatus,
  action: AppointmentAction,
  role: Role,
): AppointmentStatus {
  const row = TRANSITIONS.find((t) => t.action === action && t.from === current);
  if (!row) {
    throw conflict(
      'INVALID_STATUS_TRANSITION',
      `Cannot ${action} an appointment that is ${current}`,
    );
  }
  if (!row.roles.includes(role)) {
    throw forbidden(
      'ACTION_NOT_ALLOWED_FOR_ROLE',
      `${role} cannot ${action} a ${current} appointment`,
    );
  }
  return row.to;
}

/** Actions `role` may perform on an appointment in `current` status (for showing buttons). */
export function availableActions(current: AppointmentStatus, role: Role): AppointmentAction[] {
  return TRANSITIONS.filter((t) => t.from === current && t.roles.includes(role)).map(
    (t) => t.action,
  );
}
