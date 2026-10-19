import { describe, expect, it } from 'vitest';
import {
  AppointmentAction,
  FINAL_STATUSES,
  TRANSITIONS,
  availableActions,
  transition,
} from '../src/domain/appointmentStateMachine';
import { AppointmentStatus, Role } from '../src/domain/enums';

const ALL_ROLES = Object.values(Role);
const ALL_STATUSES = Object.values(AppointmentStatus);
const ALL_ACTIONS = Object.values(AppointmentAction);

describe('appointment state machine', () => {
  it('matches the state diagram exactly', () => {
    expect(TRANSITIONS.map((t) => `${t.from} -${t.action}-> ${t.to}`)).toEqual([
      'BOOKED -CANCEL-> CANCELLED',
      'BOOKED -CHECK_IN-> CHECKED_IN',
      'BOOKED -MARK_NO_SHOW-> NO_SHOW',
      'CHECKED_IN -START-> IN_EXAMINATION',
      'CHECKED_IN -MARK_NO_SHOW-> NO_SHOW',
      'IN_EXAMINATION -COMPLETE-> COMPLETED',
    ]);
  });

  describe.each(TRANSITIONS)('$from -$action-> $to', (t) => {
    it.each(t.roles)('is allowed for %s', (role) => {
      expect(transition(t.from, t.action, role)).toBe(t.to);
    });

    it.each(ALL_ROLES.filter((r) => !t.roles.includes(r)))('is forbidden (403) for %s', (role) => {
      expect(() => transition(t.from, t.action, role)).toThrow(
        expect.objectContaining({ status: 403, code: 'ACTION_NOT_ALLOWED_FOR_ROLE' }),
      );
    });
  });

  it('rejects every action that has no arrow from the current status (409)', () => {
    for (const status of ALL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        if (TRANSITIONS.some((t) => t.from === status && t.action === action)) continue;
        expect(() => transition(status, action, Role.ADMIN)).toThrow(
          expect.objectContaining({ status: 409, code: 'INVALID_STATUS_TRANSITION' }),
        );
      }
    }
  });

  it('has no way out of a final status', () => {
    for (const status of FINAL_STATUSES) {
      expect(TRANSITIONS.filter((t) => t.from === status)).toEqual([]);
    }
  });

  it('does not allow no-show once the examination has started', () => {
    expect(() => transition('IN_EXAMINATION', 'MARK_NO_SHOW', Role.DOCTOR)).toThrow(
      expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
    );
  });

  it('lists the actions a role can take, for showing buttons', () => {
    expect(availableActions('BOOKED', Role.RECEPTIONIST)).toEqual([
      'CANCEL',
      'CHECK_IN',
      'MARK_NO_SHOW',
    ]);
    expect(availableActions('BOOKED', Role.PATIENT)).toEqual(['CANCEL']);
    expect(availableActions('CHECKED_IN', Role.DOCTOR)).toEqual(['START', 'MARK_NO_SHOW']);
    expect(availableActions('COMPLETED', Role.ADMIN)).toEqual([]);
  });
});
