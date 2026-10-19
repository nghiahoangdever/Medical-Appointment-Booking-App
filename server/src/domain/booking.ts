// Booking rules that need no database: the booking window, capacity, doctor auto-assignment
// and appointment codes.

import { randomInt } from 'node:crypto';
import { AppointmentStatus } from './enums';
import { addDays, today } from './time';

/** Patients can book from today up to this many days ahead (today counts as day 1). */
export const BOOKING_WINDOW_DAYS = 14;

export function bookingWindow(now: Date): { first: string; last: string } {
  const first = today(now);
  return { first, last: addDays(first, BOOKING_WINDOW_DAYS - 1) };
}

/** Every appointment except a cancelled one keeps its slot (a no-show still used it). */
export function usesCapacity(status: string): boolean {
  return status !== AppointmentStatus.CANCELLED;
}

export interface Candidate {
  doctorId: number;
  maxPatients: number;
  /** Appointments that use capacity (see usesCapacity). */
  activeCount: number;
}

export function remainingSlots(c: Candidate): number {
  return Math.max(0, c.maxPatients - c.activeCount);
}

/**
 * Among roster entries with free capacity, the one with the fewest bookings
 * (tie → lowest doctorId, so the result is deterministic). Null if all are full.
 */
export function pickLeastBooked<T extends Candidate>(candidates: readonly T[]): T | null {
  const open = candidates.filter((c) => remainingSlots(c) > 0);
  open.sort((a, b) => a.activeCount - b.activeCount || a.doctorId - b.doctorId);
  return open[0] ?? null;
}

// No 0/O or 1/I, so codes are easy to read out at reception.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** e.g. "AP-7K3QXM". Uniqueness is checked against the database by the caller. */
export function generateAppointmentCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `AP-${code}`;
}
