import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, isValidDateString, startOfWeek } from '../src/domain/time';

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('numbers weekdays from Monday = 0', () => {
    expect(dayOfWeek('2026-10-19')).toBe(0); // Monday
    expect(dayOfWeek('2026-10-25')).toBe(6); // Sunday
  });

  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-10-22')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });

  it('validates real calendar dates only', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('26-2-3')).toBe(false);
  });
});
