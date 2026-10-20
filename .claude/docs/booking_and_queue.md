# Booking, availability and queue

Code: `server/src/domain/booking.ts` (pure rules), `server/src/modules/appointments/booking.service.ts`, `server/src/modules/availability/availability.service.ts`, `server/src/modules/roster/roster.repository.ts`.
Tests: `server/tests/booking.domain.test.ts`, `booking.service.test.ts`, `appointments.api.test.ts`; the whole flow (book → cancel → check in → call next → complete) in `e2e.flow.test.ts`.

## Pure rules (`domain/booking.ts`)

| Export                        | Rule                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `BOOKING_WINDOW_DAYS = 14`    | `bookingWindow(now)` → `{ first: today, last: today + 13 }`                                                   |
| `usesCapacity(status)`        | every status except `CANCELLED` uses a place (NO_SHOW and COMPLETED still count)                              |
| `remainingSlots(c)`           | `max(0, maxPatients - activeCount)`                                                                           |
| `pickLeastBooked(candidates)` | among candidates with `remainingSlots > 0`: lowest `activeCount`, tie → lowest `doctorId`; `null` if all full |
| `generateAppointmentCode()`   | `AP-` + 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I), via `crypto.randomInt`                  |

## Capacity

`activeCount` = appointments of a roster entry with `status != CANCELLED`, computed by `RosterRepository.findSlots` as a filtered `_count`. A roster entry is full when `activeCount >= maxPatients`. A cancellation frees the place immediately.

## Booking (`BookingService.book(patientId, { specialtyId, date, shiftId, doctorId?, reason? })`)

Order of checks (= steps of the "patient books" sequence diagram):

1. `date < today` → 400 `DATE_IN_PAST`; `date > today + 13` → 400 `DATE_OUTSIDE_BOOKING_WINDOW`.
2. Shift lookup → 404 `SHIFT_NOT_FOUND`; `hasTimePassed(date, shift.startTime, now)` → 400 `SHIFT_ALREADY_STARTED`.
3. **Inside `runInTransaction`:**
   1. `AppointmentRepository.findActiveForPatientInSlot(patientId, date, shiftId)` → 409 `DUPLICATE_BOOKING` (one non-cancelled appointment per patient per date + shift, across all specialties/doctors).
   2. `RosterRepository.findSlots({ specialtyId, doctorId?, shiftId, dateFrom: date, dateTo: date })` — entries of active doctors in that specialty. Empty → 404 `NO_DOCTOR_ON_DUTY`.
   3. `pickLeastBooked(candidates)` → `null` → 409 `SHIFT_FULL`. With `doctorId` given there is one candidate, so this only checks its capacity.
   4. `RosterRepository.takeNextQueueNumber(entryId)` — atomic `nextQueueNumber: { increment: 1 }`, returns the pre-increment value.
   5. Generate a code, retry up to 5 times if `codeExists`.
   6. `AppointmentRepository.create({ status: INITIAL_STATUS, ... })`.
4. Return `AppointmentView` (controller responds `201 { appointment }`).

Validation (controller, zod): `specialtyId`, `shiftId`, `doctorId?` → `id()` (`ID_INVALID`); `date` → `dateString()` (`DATE_INVALID`); `reason` trimmed, max 500 (`REASON_TOO_LONG`), blank → undefined.

## Concurrency

`DATABASE_URL` ends with `?connection_limit=1`, so Prisma uses a single SQLite connection and interactive transactions run one at a time. This is what guarantees no overbooking and no duplicate queue numbers under concurrent requests (`booking.service.test.ts` fires 6 bookings at a 3-place entry: exactly queue numbers 1–3 succeed, 3 fail with `SHIFT_FULL`). `@@unique([rosterEntryId, queueNumber])` is the backstop. Do not remove the parameter.

## Queue numbers

- Per roster entry, sequential from 1, assigned **at booking** from `RosterEntry.nextQueueNumber`.
- **Never reused**: cancelling #2 leaves a gap; the next booking gets #3. Consequently a queue number can exceed `maxPatients`.
- Never compute `MAX(queueNumber) + 1`; always use `takeNextQueueNumber` inside the booking transaction.
- Call order for doctors: the CHECKED_IN appointment with the lowest `queueNumber` (see "Doctor queue" below).

## Availability (`GET /api/availability?specialtyId&doctorId?`)

`AvailabilityService.getAvailability(specialtyId, doctorId?)`:

- 404 `SPECIALTY_NOT_FOUND` if the specialty is missing or inactive; 404 `DOCTOR_NOT_FOUND` if `doctorId` is not an active doctor of that specialty.
- Returns `{ specialty, doctor | null, days }` covering **all 14 days** of the booking window. Each day: `shifts[]` grouped by shift (sorted by start time) with `doctorsOnDuty`, `remainingSlots` (summed across doctors) and `status`:
  - `STARTED` if the shift start time has passed (takes priority),
  - else `FULL` if `remainingSlots === 0`,
  - else `AVAILABLE`.
- A day with nobody on duty has `shifts: []`.

The client wizard (`client/src/pages/patient/booking/`) disables days without shifts, pre-selects the first day with an `AVAILABLE` shift, and only lets the patient pick `AVAILABLE` shifts. On `SHIFT_FULL` / `SHIFT_ALREADY_STARTED` / `NO_DOCTOR_ON_DUTY` at confirm, it offers "Chọn ca khác" and reloads availability.

## Cancellation (patient side)

See `appointment_state_machine.md` row 1. The rule lives only in `server/src/domain/appointmentRules.ts` (`guardFailure`). The server sends `allowedActions` with every appointment, and `client/src/components/CancelAppointment.tsx` shows the button only when it contains `CANCEL`. If the appointment is `BOOKED` but `CANCEL` is missing, `MyAppointmentsPage` explains that the shift has started.

## Reception queue view (Phase 3)

`GET /api/appointments?date=…` lists a day in the order date → shift start → doctor → `queueNumber`, which is the queue order per roster entry. `counts` gives per-status totals for the same filters, ignoring the status filter. No-shows keep their place in capacity (`usesCapacity`), and checking in doesn't change the queue number.

## Doctor queue (Phase 4)

Code: `server/src/modules/queue/queue.service.ts` (`QueueService`), `client/src/pages/doctor/`.

- **Duty schedule** (`GET /api/doctor/schedule`): the doctor's roster entries from today to today + 13, earliest first, each with `counts` per status and `maxPatients`. Only the doctor's own entries are listed.
- **Queue** (`GET /api/roster-entries/:id/queue`): every appointment of the entry in `queueNumber` order, as staff views with the doctor's `allowedActions`, plus `nextAppointmentId`. Another doctor's entry returns 404 `ROSTER_ENTRY_NOT_FOUND`.
- **Call order**: the lowest `queueNumber` with status CHECKED_IN, regardless of check-in time. Patients who haven't arrived (BOOKED) are skipped, so their number is not lost and they can still be called once checked in.
- **Call next** (`POST /api/roster-entries/:id/call-next`): checks ownership (404), then `AppointmentRepository.findFirstCheckedIn` (none → 409 `NO_PATIENT_WAITING`), then `AppointmentService.start` on it. The state machine and guards apply, including `DOCTOR_BUSY` while the doctor has another patient IN_EXAMINATION that day (any shift) and `EXAM_NOT_TODAY`.
- **Out of order**: a doctor can start any waiting patient directly (`POST /api/appointments/:id/start`). The same guards apply.
- **One at a time per doctor**: at most one IN_EXAMINATION per doctor per day, across all their shifts. A morning exam left open blocks the afternoon queue. This is enforced in a transaction, and tests with concurrent requests (same shift and two different shifts) check it. The queue view adds `inExaminationElsewhere` (`{ appointmentId, rosterEntryId, queueNumber, patientName, shift }` or null) so the page can say where the open exam is and link to that queue.
- No-shows and completed exams keep their place in capacity (`usesCapacity`), and queue numbers never change.

UI (desktop):

- **Schedule:** a table with one row per shift (status counts, "Mở hàng đợi").
- **Queue page, left column:** the "Gọi bệnh nhân tiếp theo" button (disabled when `nextAppointmentId` is null, with a hint) and the patient in examination.
- **Queue page, right column:** waiting (checked in), not arrived (booked) and finished patients.
- **Refresh:** polling every 15 s plus a refresh button.

## Roster rules (admin week editor, Phase 5)

Code: `server/src/domain/rosterRules.ts` (pure rules), `server/src/modules/roster/roster.service.ts` (`RosterService`), `client/src/pages/admin/roster/`. Tests: `rosterRules.test.ts`, `roster.service.test.ts`, `admin.api.test.ts`.

| Rule                                                                                                           | Where                                                                           | Error code                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| One entry per doctor per date + shift (any room)                                                               | `RosterService.placementFailure` + schema `@@unique([doctorId, date, shiftId])` | `ROSTER_DOCTOR_CONFLICT`                                                                    |
| One entry per room per date + shift                                                                            | same + `@@unique([roomId, date, shiftId])`                                      | `ROSTER_ROOM_CONFLICT`                                                                      |
| Doctor and room must be active; shift must exist                                                               | `placementFailure`                                                              | `DOCTOR_INACTIVE`, `ROOM_INACTIVE`, `DOCTOR_NOT_FOUND`, `ROOM_NOT_FOUND`, `SHIFT_NOT_FOUND` |
| Past days are read-only (no create / update / delete); today and later are editable                            | `rosterDateFailure`                                                             | `ROSTER_DATE_IN_PAST`                                                                       |
| `maxPatients` is 1–100 and never below the entry's `activeCount` (non-cancelled bookings)                      | zod + `capacityFailure`                                                         | `MAX_PATIENTS_INVALID`, `ROSTER_CAPACITY_BELOW_BOOKED`                                      |
| Delete only if the entry has **no appointments at all**, cancelled ones included; reduce `maxPatients` instead | `deleteFailure`                                                                 | `ROSTER_HAS_APPOINTMENTS`                                                                   |
| An entry's doctor, date and shift are fixed; only room and `maxPatients` can change                            | `PATCH` accepts `{ roomId?, maxPatients? }`                                     | —                                                                                           |
| Copy previous week                                                                                             | `RosterService.copyPreviousWeek`                                                | skip reasons use the codes above                                                            |

Writes run in `runInTransaction`, so checks and the insert/update can't be raced. The unique constraints are the backstop.

**Copy previous week** (`POST /api/admin/roster/copy-previous-week { weekStart }`, a Monday) copies every entry of the week before into the same weekday, shift, room, doctor and `maxPatients`. Entries that fail any placement rule (past target day, inactive doctor or room, doctor or room already taken) are **skipped, not errors**. The response is `{ sourceWeekStart, created, skipped: [{ sourceEntryId, date, shiftId, roomId, doctorName, reason }] }`. Copying twice creates nothing new (the second run reports doctor conflicts).

**Week view** (`GET /api/admin/roster?weekStart=`, a Monday, else `WEEK_START_NOT_MONDAY`) returns:

- `days[{ date, editable }]`, `shifts`;
- `rooms`: active rooms, plus inactive ones that have entries that week;
- `doctors`: active doctors, for the picker;
- `entries`, each with `activeCount`, `appointmentCount`, `editable`, `deletable` and `minMaxPatients` (from `rosterPermissions`). The UI only offers what these flags allow.

**Bookability.** `RosterRepository.findSlots`, used by availability and booking, only returns entries whose **doctor, room and specialty are all active**. Deactivating any of them stops new bookings in their entries. Existing appointments are kept.

Roster entries are created by the admin editor, `prisma/seed.ts`, `prisma/seed-today.ts` and test fixtures.

**Known limitation (confirmed):** a booked shift can't be reassigned to another doctor: the doctor/date/shift are fixed and booked entries can't be deleted. Staff can cancel the affected appointments and lower `maxPatients`. See `data_model.md` → Known limitations.
