# Booking, availability and queue

Code: `server/src/domain/booking.ts` (pure rules), `server/src/modules/appointments/booking.service.ts`, `server/src/modules/availability/availability.service.ts`, `server/src/modules/roster/roster.repository.ts`.
Tests: `server/tests/booking.domain.test.ts`, `booking.service.test.ts`, `appointments.api.test.ts`.

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
- Call order for doctors (planned Phase 4): the CHECKED_IN appointment with the lowest `queueNumber`.

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

## Roster conflict rules

Implemented (schema): one entry per `(doctorId, date, shiftId)` and per `(roomId, date, shiftId)`.

Planned (Phase 5, admin roster editor) — not implemented:

- reject a `maxPatients` lower than the entry's current `activeCount`;
- reject deleting an entry that has non-cancelled appointments;
- "copy previous week", skipping entries that would conflict.

Roster entries are currently created only by `prisma/seed.ts` and test fixtures.
