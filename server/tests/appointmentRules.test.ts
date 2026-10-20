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
  doctorUserId: 20,
  date: '2026-10-20',
  shiftStart: '07:30',
  shiftEnd: '11:30',
  doctorInExamination: 0,
};
const checkedIn: AppointmentFacts = { ...booked, status: 'CHECKED_IN' };
const inExam: AppointmentFacts = { ...booked, status: 'IN_EXAMINATION', doctorInExamination: 1 };
const receptionist = { id: 1, role: Role.RECEPTIONIST };
const owner = { id: 7, role: Role.PATIENT };
const otherPatient = { id: 8, role: Role.PATIENT };
const doctor = { id: 20, role: Role.DOCTOR };
const otherDoctor = { id: 21, role: Role.DOCTOR };

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
    expect(allowedActions(checkedIn, receptionist, at(20, 9, 0))).toEqual([]);
  });

  it('doctor, CHECKED_IN: start (any time that day) and no-show (after shift start)', () => {
    expect(allowedActions(checkedIn, doctor, at(20, 7, 0))).toEqual(['START']);
    expect(allowedActions(checkedIn, doctor, at(20, 9, 0))).toEqual(['START', 'MARK_NO_SHOW']);
  });

  it('doctor, CHECKED_IN while examining someone else (any shift that day): no start', () => {
    expect(allowedActions({ ...checkedIn, doctorInExamination: 1 }, doctor, at(20, 9, 0))).toEqual([
      'MARK_NO_SHOW',
    ]);
  });

  it('doctor, IN_EXAMINATION: complete only; another doctor: nothing', () => {
    expect(allowedActions(inExam, doctor, at(20, 9, 0))).toEqual(['COMPLETE']);
    expect(allowedActions(inExam, otherDoctor, at(20, 9, 0))).toEqual([]);
  });
});

describe('doctor guards', () => {
  it('START: own queue, appointment date, doctor not examining anyone else', () => {
    expect(codeOf(checkedIn, 'START', doctor, at(20, 9, 0))).toBeNull();
    expect(codeOf(checkedIn, 'START', otherDoctor, at(20, 9, 0))).toBe('NOT_YOUR_PATIENT');
    expect(codeOf(checkedIn, 'START', doctor, at(21, 9, 0))).toBe('EXAM_NOT_TODAY');
    expect(codeOf({ ...checkedIn, doctorInExamination: 1 }, 'START', doctor, at(20, 9, 0))).toBe(
      'DOCTOR_BUSY',
    );
  });

  it('COMPLETE: own queue only, no time limit', () => {
    expect(codeOf(inExam, 'COMPLETE', doctor, at(20, 18, 0))).toBeNull();
    expect(codeOf(inExam, 'COMPLETE', otherDoctor, at(20, 9, 0))).toBe('NOT_YOUR_PATIENT');
  });

  it('MARK_NO_SHOW by a doctor: own queue, after shift start (ownership checked first)', () => {
    expect(codeOf(checkedIn, 'MARK_NO_SHOW', doctor, at(20, 7, 29))).toBe('NO_SHOW_TOO_EARLY');
    expect(codeOf(checkedIn, 'MARK_NO_SHOW', doctor, at(20, 7, 30))).toBeNull();
    expect(codeOf(checkedIn, 'MARK_NO_SHOW', otherDoctor, at(20, 7, 0))).toBe('NOT_YOUR_PATIENT');
  });

  it('reception no-show is not limited to a doctor', () => {
    expect(codeOf(booked, 'MARK_NO_SHOW', receptionist, at(20, 9, 0))).toBeNull();
  });
});
