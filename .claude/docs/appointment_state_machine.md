# Appointment state machine

Sources of truth:

- `server/src/domain/appointmentStateMachine.ts` — the arrows (status + action + roles). Test: `appointmentStateMachine.test.ts` (asserts the table matches the state diagram exactly).
- `server/src/domain/appointmentRules.ts` — the `[guard]` conditions on the arrows (time, ownership). Test: `appointmentRules.test.ts`.

## States

`BOOKED` (initial, `INITIAL_STATUS`) → `CHECKED_IN` → `IN_EXAMINATION` → `COMPLETED`
Alternative endings: `CANCELLED`, `NO_SHOW`.
`FINAL_STATUSES` = `COMPLETED`, `CANCELLED`, `NO_SHOW` — no transition leaves them.

## Transition table (`TRANSITIONS`, one row per diagram arrow)

| #   | From           | Action         | To             | Roles allowed (table)        | Guard (`guardFailure`) → error                                                                                    | Endpoint                                                                       | Status                                                                             |
| --- | -------------- | -------------- | -------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 0   | —              | book           | BOOKED         | PATIENT                      | see `booking_and_queue.md`                                                                                        | `POST /api/appointments`                                                       | implemented                                                                        |
| 1   | BOOKED         | `CANCEL`       | CANCELLED      | PATIENT, RECEPTIONIST, ADMIN | Patient: own appointment (`NOT_YOUR_APPOINTMENT`) and before shift start (`CANCEL_DEADLINE_PASSED`). Staff: none. | `POST /api/appointments/:id/cancel`                                            | implemented                                                                        |
| 2   | BOOKED         | `CHECK_IN`     | CHECKED_IN     | RECEPTIONIST                 | appointment date = today (`CHECK_IN_NOT_TODAY`) and shift not ended (`CHECK_IN_SHIFT_ENDED`)                      | `POST /api/appointments/:id/check-in`                                          | implemented                                                                        |
| 3   | BOOKED         | `MARK_NO_SHOW` | NO_SHOW        | RECEPTIONIST, DOCTOR         | shift has started (`NO_SHOW_TOO_EARLY`); no upper limit (later days allowed)                                      | `POST /api/appointments/:id/no-show`                                           | implemented for RECEPTIONIST; DOCTOR route + ownership guard **planned (Phase 4)** |
| 4   | CHECKED_IN     | `START`        | IN_EXAMINATION | DOCTOR                       | doctor owns the roster entry; no other IN_EXAMINATION in that entry                                               | `POST /api/roster-entries/:id/call-next` or `POST /api/appointments/:id/start` | table row only; guards + endpoints **planned (Phase 4)**                           |
| 5   | CHECKED_IN     | `MARK_NO_SHOW` | NO_SHOW        | DOCTOR                       | doctor owns the roster entry                                                                                      | `POST /api/appointments/:id/no-show`                                           | table row only; **planned (Phase 4)**                                              |
| 6   | IN_EXAMINATION | `COMPLETE`     | COMPLETED      | DOCTOR                       | doctor owns the roster entry                                                                                      | `POST /api/appointments/:id/complete`                                          | table row only; **planned (Phase 4)**                                              |

All guard errors are 409. "Shift started/ended" means `hasTimePassed(date, shift.startTime|endTime, now)` — inclusive: at exactly 07:30 the 07:30 shift has started.
Deliberately absent: `IN_EXAMINATION → NO_SHOW` and any transition out of a final state. Reception cannot act on a CHECKED_IN appointment (the doctor takes over).

## Module API

```ts
// appointmentStateMachine.ts — status + role only
transition(current, action, role): AppointmentStatus
  // no row for (action, current)      → 409 INVALID_STATUS_TRANSITION
  // row exists, role not in row.roles → 403 ACTION_NOT_ALLOWED_FOR_ROLE
availableActions(current, role): AppointmentAction[]
INITIAL_STATUS, FINAL_STATUSES, TRANSITIONS, AppointmentAction

// appointmentRules.ts — guards; pure, take `now`
interface Actor { id; role }
interface AppointmentFacts { status; patientId; date; shiftStart; shiftEnd }
guardFailure(facts, action, actor, now): AppError | null   // START/COMPLETE: no guards yet (Phase 4)
allowedActions(facts, actor, now): AppointmentAction[]    // availableActions filtered by guards
```

`allowedActions` is put on every appointment the API returns (`appointment.mapper.ts`, via `appointmentFacts(record)`), computed for the viewer at the service clock's "now". The client renders buttons only from it (patients: cancel; reception: check-in, no-show, cancel).

## How a service applies a transition

`AppointmentService.perform(actor, id, action, extraData)` (`server/src/modules/appointments/appointment.service.ts`), used by `cancel`, `checkIn`, `markNoShow`:

1. `findVisibleTo(actor, id)` — load; patients get 404 `APPOINTMENT_NOT_FOUND` for appointments they don't own.
2. `transition(from, action, actor.role)` — 409 / 403 as above.
3. `guardFailure(appointmentFacts(appointment), action, actor, now)` — throw if not null.
4. `AppointmentRepository.updateStatus(id, from, { status: to, ...extraData(now) })` — updates **only if status is still `from`**; 0 rows → 409 `APPOINTMENT_CHANGED`.
5. Reload and return `toViewFor(record, actor, now)` (patient view or staff view).

Timestamps written: CHECKED_IN → `checkedInAt`; IN_EXAMINATION → `startedAt` (Phase 4); COMPLETED → `completedAt` (Phase 4); CANCELLED → `cancelledAt` + `cancelledById` + `cancelReason`. `NO_SHOW` has no timestamp column. All come from the service clock (`now`), as does `bookedAt` at booking.

Notes are not a transition: `AppointmentService.addNote` works in any status, staff only (patients → 403 `ACTION_NOT_ALLOWED_FOR_ROLE`).

## Rules

- Never assign `status` anywhere except through `perform` (or `INITIAL_STATUS` at booking). Seeds that need other statuses must go through the services (see `server/prisma/seed-today.ts`).
- A new arrow = a row in `TRANSITIONS` + the expected list in `appointmentStateMachine.test.ts` + a `guardFailure` case if it has a guard + a service method using `perform` + an action endpoint + update this file and `design_mapping.md` + tell the user (state diagram changes).
- Client labels per status: `client/src/i18n/labels.ts` (`STATUS_LABEL`); badge colours: `client/src/components/StatusBadge.tsx`.
