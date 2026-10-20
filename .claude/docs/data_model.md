# Data model

Source of truth: `server/prisma/schema.prisma` (SQLite, Prisma 6). It is the class diagram — keep both in sync.

## Conventions

- **No native enums** (SQLite). Enum-like columns are `String`; allowed values live in `server/src/domain/enums.ts` (`Role`, `Gender`, `AppointmentStatus`). Validate with zod (`z.enum(Gender)`) or the domain before writing.
- **Dates/times are strings**: calendar dates `YYYY-MM-DD`, times of day `HH:mm`. Only audit timestamps are `DateTime`. See `date_logic.md`.
- **IDs**: `Int @id @default(autoincrement())`. The seed resets `sqlite_sequence`, so demo ids are predictable.
- All database values (enum strings, shift names `Morning`/`Afternoon`) are English. Display content entered by people (names, descriptions) may be Vietnamese.
- Schema change workflow: edit `schema.prisma` → `npm run db:migrate -w server -- --name <change>` → commit the generated folder under `prisma/migrations/` → update fixtures/seed if needed → update this file and `design_mapping.md`.

## Entities

| Model             | Fields                                                                                                                                                                                                     | Notes                                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`            | id, fullName, email (unique), phone (unique), passwordHash, role, isActive (default true), createdAt                                                                                                       | role ∈ PATIENT, RECEPTIONIST, DOCTOR, ADMIN. Email stored lowercase.                                                                                                                                                                      |
| `PatientProfile`  | userId (PK, FK User), dateOfBirth (YYYY-MM-DD), gender, address?                                                                                                                                           | 1:0..1 with User; created on patient registration. `onDelete: Cascade`.                                                                                                                                                                   |
| `Doctor`          | id, userId (unique FK User), specialtyId (FK), title, bio?                                                                                                                                                 | 1:0..1 with User; exactly one specialty. `onDelete: Cascade` from User.                                                                                                                                                                   |
| `Specialty`       | id, name (unique), description?, isActive                                                                                                                                                                  |                                                                                                                                                                                                                                           |
| `Room`            | id, code (unique, e.g. `A1-01`), name, floor?, isActive                                                                                                                                                    | Not tied to a specialty.                                                                                                                                                                                                                  |
| `Shift`           | id, name (unique), startTime, endTime                                                                                                                                                                      | Fixed set seeded: `Morning` 07:30–11:30, `Afternoon` 13:00–17:00.                                                                                                                                                                         |
| `RosterEntry`     | id, doctorId, roomId, shiftId, date, maxPatients, nextQueueNumber (default 1)                                                                                                                              | One doctor on duty in one room for one shift on one date.                                                                                                                                                                                 |
| `Appointment`     | id, code (unique), patientId (FK User), rosterEntryId, queueNumber, status, reason?, bookedAt (default now), checkedInAt?, startedAt?, completedAt?, cancelledAt?, cancelledById? (FK User), cancelReason? | Doctor, room, date, shift and specialty are reached through `rosterEntry` — never duplicated on Appointment.                                                                                                                              |
| `AppointmentNote` | id, appointmentId, authorId (FK User), content, createdAt                                                                                                                                                  | Internal staff notes. Created via `POST /api/appointments/:id/notes` (`NoteRepository.create`, `createdAt` from the service clock); read as part of `StaffAppointmentView`; never sent to patients. `onDelete: Cascade` from Appointment. |

## Relationships

```
Specialty 1 ── * Doctor
User 1 ── 0..1 Doctor            User 1 ── 0..1 PatientProfile
Doctor 1 ── * RosterEntry        Room 1 ── * RosterEntry        Shift 1 ── * RosterEntry
RosterEntry 1 ── * Appointment   User(patient) 1 ── * Appointment   ("PatientAppointments")
User 1 ── * Appointment as canceller ("CancelledBy")
Appointment 1 ── * AppointmentNote   User 1 ── * AppointmentNote (author)
```

Receptionist and Admin have no extra table: they are `User` rows with that role.

## Unique constraints and indexes

| Constraint                                                                   | Meaning                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `User.email`, `User.phone`                                                   | Login identifier; registration returns `EMAIL_TAKEN` / `PHONE_TAKEN` before hitting these |
| `Specialty.name`, `Room.code`, `Shift.name`                                  | Natural keys                                                                              |
| `Doctor.userId`                                                              | One doctor profile per user                                                               |
| `RosterEntry @@unique([doctorId, date, shiftId])`                            | A doctor can't be in two places in the same shift                                         |
| `RosterEntry @@unique([roomId, date, shiftId])`                              | A room can't host two doctors in the same shift                                           |
| `Appointment.code`                                                           | Appointment code is globally unique                                                       |
| `Appointment @@unique([rosterEntryId, queueNumber])`                         | Backstop: queue numbers can't repeat within a roster entry                                |
| `@@index`: `RosterEntry.date`, `Appointment.patientId`, `Appointment.status` | Query performance                                                                         |

A Prisma `P2002` (unique violation) that slips past service checks is mapped to `409 ALREADY_EXISTS` by `errorHandler`.

## Soft delete (`isActive`)

Specialties, rooms and user accounts are never deleted; admins deactivate and reactivate them through `POST /api/admin/<specialties|rooms|doctors|receptionists>/:id/(deactivate|activate)` (Phase 5). The only hard delete is a roster entry that was never booked (see `booking_and_queue.md`). Behaviour:

- **Deactivation guard:** a specialty, room or doctor can't be deactivated while it has appointments from today on that are still open (BOOKED / CHECKED_IN / IN_EXAMINATION). The error is 409 `HAS_UPCOMING_APPOINTMENTS` (`AppointmentRepository.countUpcomingOpen`). Receptionists can always be deactivated.
- `User.isActive = false`:
  - login returns `403 ACCOUNT_DISABLED`;
  - **every authenticated request** returns `403 ACCOUNT_DISABLED`, including `/api/auth/me` with a still-valid token. `authenticate` re-reads the account each time via `AuthService.getCurrentUser`, and the client then logs the user out;
  - reactivating the account makes the same token work again (until it expires);
  - a deleted account gets `401 INVALID_TOKEN`;
  - the role used for authorization comes from the database, not the token.
- Inactive doctors are excluded from:
  - doctor lists;
  - availability and booking (`findSlots`);
  - the roster editor's doctor picker, and new roster entries are refused (`DOCTOR_INACTIVE`).
- `Specialty.isActive = false`:
  - hidden from `GET /api/specialties`, and `/:id/doctors` and availability return `404 SPECIALTY_NOT_FOUND`;
  - its roster entries take no new bookings (`findSlots` filters `specialty.isActive`);
  - no new doctors can be added to it (`SPECIALTY_INACTIVE`).
- `Room.isActive = false`:
  - can't be used for new or moved roster entries (`ROOM_INACTIVE`);
  - its entries take no new bookings (`findSlots` filters `room.isActive`);
  - shown in the roster grid only for weeks where it still has entries.
- A doctor's specialty is **fixed after creation**, because appointments reach their specialty through `rosterEntry → doctor → specialty`, so changing it would rewrite history. Admins can change name, contact details, title, bio and password.

### Known limitations (confirmed)

- **Reassigning a booked shift to another doctor is not supported.** A roster entry's doctor, date and shift are fixed, and an entry with any appointment (cancelled ones included) can't be deleted. If a doctor becomes unavailable for a booked shift, staff can only cancel the affected appointments (reception/admin cancel) and lower `maxPatients`. There is no "move these patients to doctor X" operation.

## Demo seed (`server/prisma/seed.ts`)

Wipes every table (children first) and resets ids, then creates: 1 admin, 2 receptionists, 3 specialties × 2 doctors, 8 rooms (A1-01…B2-03, one per doctor; B2-04 free; C3-01 inactive "đang sửa chữa"), 2 shifts, roster entries for the current and next week (Mon–Sat; mornings maxPatients 10, afternoons 6), 3 patients, and 2 BOOKED appointments in doctor 1's next morning shift after today (queue 1 and 2, `nextQueueNumber` set to 3). All passwords: `password123`.

## Dev scenario seed (`server/prisma/seed-today.ts`, `npm run db:seed:today -w server`)

Dev only (refuses `NODE_ENV=production`); run after the main seed. For **today** (any weekday): upserts Morning (max 10) and Afternoon (max 6) roster entries for doctor1 (room A1-01) and doctor3 (room A1-03), deletes those entries' appointments/notes and resets `nextQueueNumber` to 1, upserts patients 4–8 (`patient4@example.com`…, phones `091100000x`). It then creates 13 appointments **through `BookingService` / `AppointmentService` with fixed clocks**:

- bookings at 06:00;
- check-ins between 07:15 and 12:45;
- one patient cancel at 06:30;
- doctor3 starts at 07:40 and completes at 07:55 for one patient, then starts the next at 07:56;
- one reception note and one doctor note.

Result: 6 BOOKED, 4 CHECKED_IN, 1 IN_EXAMINATION, 1 COMPLETED, 1 CANCELLED. Idempotent for today's data.
