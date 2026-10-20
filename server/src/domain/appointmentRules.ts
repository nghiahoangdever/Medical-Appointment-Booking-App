// Guards on the state-machine arrows that depend on time or on who is acting — the parts of
// the state diagram's [guard] conditions that the transition table (status + role) can't express.
// Used both to reject actions and to tell clients which actions are possible right now
// (`allowedActions`), so the UI never re-implements these rules.

import { AppointmentAction, availableActions } from './appointmentStateMachine';
import { Role, type AppointmentStatus } from './enums';
import { conflict, type AppError } from './errors';
import { hasTimePassed, today } from './time';

/** Who is performing an action. */
export interface Actor {
  id: number;
  role: Role;
}

/** The facts about an appointment that the guards need. */
export interface AppointmentFacts {
  status: AppointmentStatus;
  patientId: number;
  date: string;
  shiftStart: string;
  shiftEnd: string;
}

/**
 * The guard error blocking `action` right now, or null if the guards pass.
 * Status and role are checked separately by `transition()`.
 */
export function guardFailure(
  facts: AppointmentFacts,
  action: AppointmentAction,
  actor: Actor,
  now: Date,
): AppError | null {
  switch (action) {
    case AppointmentAction.CANCEL:
      // Patients: own appointment, before the shift starts. Staff: no time limit.
      if (actor.role !== Role.PATIENT) return null;
      if (facts.patientId !== actor.id) {
        return conflict('NOT_YOUR_APPOINTMENT', 'Patients can only cancel their own appointments');
      }
      if (hasTimePassed(facts.date, facts.shiftStart, now)) {
        return conflict(
          'CANCEL_DEADLINE_PASSED',
          'Appointments can only be cancelled before the shift starts',
        );
      }
      return null;

    case AppointmentAction.CHECK_IN:
      if (facts.date !== today(now)) {
        return conflict('CHECK_IN_NOT_TODAY', 'Check-in is only possible on the appointment date');
      }
      if (hasTimePassed(facts.date, facts.shiftEnd, now)) {
        return conflict('CHECK_IN_SHIFT_ENDED', 'The shift has already ended');
      }
      return null;

    case AppointmentAction.MARK_NO_SHOW:
      if (!hasTimePassed(facts.date, facts.shiftStart, now)) {
        return conflict('NO_SHOW_TOO_EARLY', 'No-show can only be marked after the shift starts');
      }
      return null;

    // START / COMPLETE guards (doctor owns the roster entry, one patient at a time): Phase 4.
    default:
      return null;
  }
}

/** Actions `actor` can take on this appointment now: status + role (state machine) + guards. */
export function allowedActions(
  facts: AppointmentFacts,
  actor: Actor,
  now: Date,
): AppointmentAction[] {
  return availableActions(facts.status, actor.role).filter(
    (action) => guardFailure(facts, action, actor, now) === null,
  );
}
