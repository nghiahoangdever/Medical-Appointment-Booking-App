import { describe, expect, it } from 'vitest';
import {
  capacityFailure,
  deleteFailure,
  rosterDateFailure,
  rosterPermissions,
} from '../src/domain/rosterRules';

const NOW = new Date(2026, 9, 20, 9, 0); // Tue 20/10/2026 09:00
const codeOf = (e: { code: string } | null) => e?.code ?? null;

describe('roster rules (pure)', () => {
  it('makes past days read-only, today and later editable', () => {
    expect(codeOf(rosterDateFailure('2026-10-19', NOW))).toBe('ROSTER_DATE_IN_PAST');
    expect(rosterDateFailure('2026-10-20', NOW)).toBeNull();
    expect(rosterDateFailure('2026-11-30', NOW)).toBeNull();
  });

  it('keeps capacity at or above the places already taken', () => {
    const facts = { date: '2026-10-21', activeCount: 3, appointmentCount: 4 };
    expect(codeOf(capacityFailure(facts, 2))).toBe('ROSTER_CAPACITY_BELOW_BOOKED');
    expect(capacityFailure(facts, 3)).toBeNull();
  });

  it('deletes only never-booked entries (cancelled bookings count)', () => {
    expect(
      deleteFailure({ date: '2026-10-21', activeCount: 0, appointmentCount: 0 }, NOW),
    ).toBeNull();
    expect(
      codeOf(deleteFailure({ date: '2026-10-21', activeCount: 0, appointmentCount: 1 }, NOW)),
    ).toBe('ROSTER_HAS_APPOINTMENTS');
    expect(
      codeOf(deleteFailure({ date: '2026-10-19', activeCount: 0, appointmentCount: 0 }, NOW)),
    ).toBe('ROSTER_DATE_IN_PAST');
  });

  it('summarises what the editor may offer', () => {
    expect(
      rosterPermissions({ date: '2026-10-21', activeCount: 2, appointmentCount: 3 }, NOW),
    ).toEqual({
      editable: true,
      deletable: false,
      minMaxPatients: 2,
    });
    expect(
      rosterPermissions({ date: '2026-10-21', activeCount: 0, appointmentCount: 0 }, NOW),
    ).toEqual({
      editable: true,
      deletable: true,
      minMaxPatients: 1,
    });
    expect(
      rosterPermissions({ date: '2026-10-19', activeCount: 0, appointmentCount: 0 }, NOW),
    ).toEqual({
      editable: false,
      deletable: false,
      minMaxPatients: 1,
    });
  });
});
