# Appointment state machine

Sources of truth:

- `server/src/domain/appointmentStateMachine.ts` — the arrows (status + action + roles). Test: `appointmentStateMachine.test.ts` (asserts the table matches the state diagram exactly).
- `server/src/domain/appointmentRules.ts` — the `[guard]` conditions on the arrows (time, ownership, one exam at a time). Test: `appointmentRules.test.ts`.

## States

`BOOKED` (initial, `INITIAL_STATUS`) → `CHECKED_IN` → `IN_EXAMINATION` → `COMPLETED`
Alternative endings: `CANCELLED`, `NO_SHOW`.
`FINAL_STATUSES` = `COMPLETED`, `CANCELLED`, `NO_SHOW` — no transition leaves them.

## Transition table (`TRANSITIONS`, one row per diagram arrow)

All rows are implemented (table row + guard + service method + endpoint).

| #   | From           | Action         | To             | Roles allowed (table)        | Guard (`guardFailure`) → error                                                                                                                                                                                                                        | Service method / endpoint                                                                                                                    |
| --- | -------------- | -------------- | -------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | —              | book           | BOOKED         | PATIENT                      | see `booking_and_queue.md`                                                                                                                                                                                                                            | `BookingService.book` / `POST /api/appointments`                                                                                             |
| 1   | BOOKED         | `CANCEL`       | CANCELLED      | PATIENT, RECEPTIONIST, ADMIN | Patient: own appointment (`NOT_YOUR_APPOINTMENT`) and before shift start (`CANCEL_DEADLINE_PASSED`). Staff: none.                                                                                                                                     | `AppointmentService.cancel` / `POST /api/appointments/:id/cancel`                                                                            |
| 2   | BOOKED         | `CHECK_IN`     | CHECKED_IN     | RECEPTIONIST                 | appointment date = today (`CHECK_IN_NOT_TODAY`) and shift not ended (`CHECK_IN_SHIFT_ENDED`)                                                                                                                                                          | `AppointmentService.checkIn` / `POST /api/appointments/:id/check-in`                                                                         |
| 3   | BOOKED         | `MARK_NO_SHOW` | NO_SHOW        | RECEPTIONIST, DOCTOR         | Doctor: own roster entry (`NOT_YOUR_PATIENT`). Both: shift has started (`NO_SHOW_TOO_EARLY`); no upper limit.                                                                                                                                         | `AppointmentService.markNoShow` / `POST /api/appointments/:id/no-show`                                                                       |
| 4   | CHECKED_IN     | `START`        | IN_EXAMINATION | DOCTOR                       | own roster entry (`NOT_YOUR_PATIENT`); appointment date = today (`EXAM_NOT_TODAY`); the doctor has nobody else IN_EXAMINATION that day in any of their shifts (`DOCTOR_BUSY`). No shift-time limit: a doctor may start early or run over (confirmed). | `AppointmentService.start` / `POST /api/appointments/:id/start`; also via `QueueService.callNext` / `POST /api/roster-entries/:id/call-next` |
| 5   | CHECKED_IN     | `MARK_NO_SHOW` | NO_SHOW        | DOCTOR                       | own roster entry (`NOT_YOUR_PATIENT`); shift has started (`NO_SHOW_TOO_EARLY`)                                                                                                                                                                        | `AppointmentService.markNoShow` / `POST /api/appointments/:id/no-show`                                                                       |
| 6   | IN_EXAMINATION | `COMPLETE`     | COMPLETED      | DOCTOR                       | own roster entry (`NOT_YOUR_PATIENT`); no time limit                                                                                                                                                                                                  | `AppointmentService.complete` / `POST /api/appointments/:id/complete`                                                                        |

All guard errors are 409. "Shift started/ended" means `hasTimePassed(date, shift.startTime|endTime, now)`, which is inclusive: at exactly 07:30 the 07:30 shift has started. Guards are checked in the order listed (ownership first).
Deliberately absent: `IN_EXAMINATION → NO_SHOW` and any transition out of a final state. Reception cannot act on a CHECKED_IN appointment (the doctor takes over).

"One patient at a time" is **per doctor, across all their shifts on the same date**. A morning patient still in examination blocks starting anyone in that doctor's afternoon queue. It's scoped to the date so a forgotten exam from a previous day can't block the doctor forever; it can still be completed, since COMPLETE has no time limit. The queue view reports such a blocking exam in another shift as `inExaminationElsewhere`.

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
interface AppointmentFacts {
  status; patientId;
  doctorUserId;            // user id of the roster entry's doctor
  date; shiftStart; shiftEnd;
  doctorInExamination;     // IN_EXAMINATION count for the same doctor on the same date (all shifts)
}
guardFailure(facts, action, actor, now): AppError | null
allowedActions(facts, actor, now): AppointmentAction[]    // availableActions filtered by guards
```

`appointmentFacts(record)` (`appointment.mapper.ts`) builds the facts. `doctorInExamination` is attached by `AppointmentRepository` to every record it returns (`withDoctorLoad`: one extra query per read, grouped by doctor + date, run inside the same transaction when given `tx`). So every loaded appointment knows whether its doctor is busy that day.

`allowedActions` is put on every appointment the API returns, computed for the viewer at the service clock's "now". The client renders buttons only from it:

- patients: cancel;
- reception: check-in, no-show, cancel;
- doctors: start, complete, no-show.

The doctor queue also returns `nextAppointmentId`, the lowest-numbered CHECKED_IN appointment whose `allowedActions` includes `START`.

## How a service applies a transition

`AppointmentService.perform(actor, id, action, extraData)` (`server/src/modules/appointments/appointment.service.ts`), used by `cancel`, `checkIn`, `markNoShow`, `start`, `complete`. **Steps 1–4 run inside `runInTransaction`** (serialized by `connection_limit=1`), so a guard that looks at other appointments (`DOCTOR_BUSY`) can't be raced by a concurrent request:

1. `findVisibleTo(actor, id, tx)` loads the appointment. Patients get 404 `APPOINTMENT_NOT_FOUND` for appointments they don't own; **doctors get 404 for appointments outside their own roster entries**.
2. `transition(from, action, actor.role)` (409 / 403 as above).
3. `guardFailure(appointmentFacts(appointment), action, actor, now)`; throw if not null.
4. `AppointmentRepository.updateStatus(id, from, { status: to, ...extraData(now) }, tx)` updates **only if status is still `from`**. If 0 rows change: 409 `APPOINTMENT_CHANGED`.
5. After the commit, reload and return `toViewFor(record, actor, now)` (patient view or staff view).

Timestamps written:

- CHECKED_IN → `checkedInAt`
- IN_EXAMINATION → `startedAt`
- COMPLETED → `completedAt`
- CANCELLED → `cancelledAt` + `cancelledById` + `cancelReason`
- `NO_SHOW` has no timestamp column.

All come from the service clock (`now`), as does `bookedAt` at booking.

Notes are not a transition. `AppointmentService.addNote` works in any status, staff only (patients get 403 `ACTION_NOT_ALLOWED_FOR_ROLE`), and uses the same visibility rule (doctors: own queue only).

## Rules

- Never assign `status` anywhere except through `perform` (or `INITIAL_STATUS` at booking). Seeds that need other statuses must go through the services (see `server/prisma/seed-today.ts`).
- A new arrow needs all of the following, then tell the user (the state diagram changes):
  - a row in `TRANSITIONS`;
  - the expected list in `appointmentStateMachine.test.ts`;
  - a `guardFailure` case if it has a guard;
  - a service method using `perform`;
  - an action endpoint;
  - updates to this file and `design_mapping.md`.
- Client labels per status: `client/src/i18n/labels.ts` (`STATUS_LABEL`). Badge colours: `client/src/components/StatusBadge.tsx`. Action button labels: `client/src/components/StaffActions.tsx`.
