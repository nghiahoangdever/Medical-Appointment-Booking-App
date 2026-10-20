// Rules for editing the duty roster (UC-A6 / UC-A7) that need no database: past entries are
// read-only, capacity can't drop below what is already booked, and an entry with bookings can't
// be deleted. Conflicts (one doctor / one room per date + shift) need the database and live in
// RosterService, backed by the schema's unique constraints.

import { conflict, type AppError } from './errors';
import { today } from './time';

/** Upper bound for maxPatients on one roster entry. */
export const MAX_PATIENTS_LIMIT = 100;

export interface RosterEntryFacts {
  date: string;
  /** Appointments using capacity (every status except CANCELLED). */
  activeCount: number;
  /** All appointments, including cancelled ones. */
  appointmentCount: number;
}

/** Entries for past days are history and read-only; today and later can be changed. */
export function rosterDateFailure(date: string, now: Date): AppError | null {
  return date < today(now)
    ? conflict('ROSTER_DATE_IN_PAST', 'Past roster entries cannot be changed')
    : null;
}

/** maxPatients may not go below the places already taken. */
export function capacityFailure(facts: RosterEntryFacts, maxPatients: number): AppError | null {
  return maxPatients < facts.activeCount
    ? conflict(
        'ROSTER_CAPACITY_BELOW_BOOKED',
        `${facts.activeCount} places are already booked; maxPatients cannot be lower`,
      )
    : null;
}

/**
 * An entry can be deleted only if nobody ever booked it: active bookings would be orphaned,
 * and cancelled ones are part of patients' history. Reduce maxPatients instead.
 */
export function deleteFailure(facts: RosterEntryFacts, now: Date): AppError | null {
  return (
    rosterDateFailure(facts.date, now) ??
    (facts.appointmentCount > 0
      ? conflict('ROSTER_HAS_APPOINTMENTS', 'This roster entry has appointments')
      : null)
  );
}

/** What the admin UI may offer for an entry (so the client holds no copy of these rules). */
export function rosterPermissions(facts: RosterEntryFacts, now: Date) {
  return {
    editable: rosterDateFailure(facts.date, now) === null,
    deletable: deleteFailure(facts, now) === null,
    minMaxPatients: Math.max(1, facts.activeCount),
  };
}
