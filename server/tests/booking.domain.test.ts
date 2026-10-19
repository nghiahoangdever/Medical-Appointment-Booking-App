import { describe, expect, it } from 'vitest';
import {
  bookingWindow,
  generateAppointmentCode,
  pickLeastBooked,
  usesCapacity,
} from '../src/domain/booking';
import { hasTimePassed } from '../src/domain/time';

describe('booking rules (pure)', () => {
  it('opens a 14-day window starting today', () => {
    expect(bookingWindow(new Date(2026, 9, 20, 9, 0))).toEqual({
      first: '2026-10-20',
      last: '2026-11-02',
    });
  });

  it('counts every status except CANCELLED toward capacity', () => {
    expect(usesCapacity('CANCELLED')).toBe(false);
    for (const s of ['BOOKED', 'CHECKED_IN', 'IN_EXAMINATION', 'COMPLETED', 'NO_SHOW']) {
      expect(usesCapacity(s)).toBe(true);
    }
  });

  it('picks the least-booked entry with room, tie → lowest doctorId', () => {
    const a = { doctorId: 1, maxPatients: 5, activeCount: 2 };
    const b = { doctorId: 2, maxPatients: 5, activeCount: 1 };
    const c = { doctorId: 3, maxPatients: 5, activeCount: 1 };
    const full = { doctorId: 0, maxPatients: 1, activeCount: 1 };
    expect(pickLeastBooked([a, b, c, full])).toBe(b);
    expect(pickLeastBooked([full])).toBeNull();
    expect(pickLeastBooked([])).toBeNull();
  });

  it('generates readable codes', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateAppointmentCode()).toMatch(/^AP-[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('knows when a shift has started', () => {
    const now = new Date(2026, 9, 20, 9, 0); // 20/10/2026 09:00
    expect(hasTimePassed('2026-10-20', '07:30', now)).toBe(true);
    expect(hasTimePassed('2026-10-20', '09:00', now)).toBe(true);
    expect(hasTimePassed('2026-10-20', '13:00', now)).toBe(false);
    expect(hasTimePassed('2026-10-19', '13:00', now)).toBe(true);
    expect(hasTimePassed('2026-10-21', '07:30', now)).toBe(false);
  });
});
