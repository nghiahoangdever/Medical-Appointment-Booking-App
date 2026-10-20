// Time/ownership guards and allowedActions, as pure functions.
// The appointment is on 20/10/2026, Morning shift 07:30–11:30.

import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  guardFailure,
  type AppointmentFacts,
} from '../src/domain/appointmentRules';
import { Role } from '../src/domain/enums';

const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes);

const booked: AppointmentFacts = {
  status: 'BOOKED',
  patientId: 7,
  date: '2026-10-20',
  shiftStart: '07:30',
  shiftEnd: '11:30',
};
const receptionist = { id: 1, role: Role.RECEPTIONIST };
const owner = { id: 7, role: Role.PATIENT };
const otherPatient = { id: 8, role: Role.PATIENT };

const codeOf = (...args: Parameters<typeof guardFailure>) => guardFailure(...args)?.code ?? null;

describe('CHECK_IN guard', () => {
  it('allows check-in on the day, before and during the shift', () => {
    expect(codeOf(booked, 'CHECK_IN', receptionist, at(20, 6, 0))).toBeNull();
    expect(codeOf(booked, 'CHECK_IN', receptionist, at(20, 9, 0))).toBeNull();
    expect(codeOf(booked, 'CHECK_IN', receptionist, at(20, 11, 29))).toBeNull();
  });

  it('rejects once the shift has ended (CHECK_IN_SHIFT_ENDED)', () => {
    expect(codeOf(booked, 'CHECK_IN', receptionist, at(20, 11, 30))).toBe('CHECK_IN_SHIFT_ENDED');
  });

  it('rejects on any other day (CHECK_IN_NOT_TODAY)', () => {
    expect(codeOf(booked, 'CHECK_IN', receptionist, at(19, 9, 0))).toBe('CHECK_IN_NOT_TODAY');
    expect(codeOf(booked, 'CHECK_IN', receptionist, at(21, 9, 0))).toBe('CHECK_IN_NOT_TODAY');
  });
});

describe('MARK_NO_SHOW guard', () => {
  it('rejects before the shift starts (NO_SHOW_TOO_EARLY)', () => {
    expect(codeOf(booked, 'MARK_NO_SHOW', receptionist, at(20, 7, 29))).toBe('NO_SHOW_TOO_EARLY');
    expect(codeOf(booked, 'MARK_NO_SHOW', receptionist, at(19, 22, 0))).toBe('NO_SHOW_TOO_EARLY');
  });

  it('allows from the shift start onwards, including later days', () => {
    expect(codeOf(booked, 'MARK_NO_SHOW', receptionist, at(20, 7, 30))).toBeNull();
    expect(codeOf(booked, 'MARK_NO_SHOW', receptionist, at(20, 15, 0))).toBeNull();
    expect(codeOf(booked, 'MARK_NO_SHOW', receptionist, at(22, 9, 0))).toBeNull();
  });
});

describe('CANCEL guard', () => {
  it('lets the owner cancel only before the shift starts', () => {
    expect(codeOf(booked, 'CANCEL', owner, at(20, 7, 29))).toBeNull();
    expect(codeOf(booked, 'CANCEL', owner, at(20, 7, 30))).toBe('CANCEL_DEADLINE_PASSED');
  });

  it("rejects another patient's appointment", () => {
    expect(codeOf(booked, 'CANCEL', otherPatient, at(20, 6, 0))).toBe('NOT_YOUR_APPOINTMENT');
  });

  it('puts no time limit on staff', () => {
    expect(codeOf(booked, 'CANCEL', receptionist, at(20, 15, 0))).toBeNull();
  });
});

describe('allowedActions', () => {
  it('reception, BOOKED, before the shift: cancel and check in', () => {
    expect(allowedActions(booked, receptionist, at(20, 6, 0))).toEqual(['CANCEL', 'CHECK_IN']);
  });

  it('reception, BOOKED, during the shift: cancel, check in, no-show', () => {
    expect(allowedActions(booked, receptionist, at(20, 9, 0))).toEqual([
      'CANCEL',
      'CHECK_IN',
      'MARK_NO_SHOW',
    ]);
  });

  it('reception, BOOKED, after the shift: cancel, no-show', () => {
    expect(allowedActions(booked, receptionist, at(20, 12, 0))).toEqual(['CANCEL', 'MARK_NO_SHOW']);
  });

  it('patient: cancel only before the shift', () => {
    expect(allowedActions(booked, owner, at(20, 6, 0))).toEqual(['CANCEL']);
    expect(allowedActions(booked, owner, at(20, 9, 0))).toEqual([]);
  });

  it('reception has nothing to do once checked in (the doctor takes over)', () => {
    expect(allowedActions({ ...booked, status: 'CHECKED_IN' }, receptionist, at(20, 9, 0))).toEqual(
      [],
    );
  });
});
