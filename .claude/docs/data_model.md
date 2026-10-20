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

Nothing is hard-deleted by the app. Current behaviour:

- `User.isActive = false` → login returns `403 ACCOUNT_DISABLED`; `GET /api/auth/me` returns `401 INVALID_TOKEN`. Existing JWTs still pass `authenticate` until they expire (it does not hit the DB).
- Doctors are "active" when their `user.isActive` is true: inactive doctors are excluded from doctor lists, availability and booking candidates.
- `Specialty.isActive = false` → hidden from `GET /api/specialties`; `GET /api/specialties/:id/doctors` and availability return `404 SPECIALTY_NOT_FOUND`. `BookingService` does not check the specialty flag itself (it relies on roster candidates).
- `Room.isActive` exists but **no query checks it yet**.
- Admin deactivate/reactivate endpoints and UI: **planned (Phase 5)**.

## Demo seed (`server/prisma/seed.ts`)

Wipes every table (children first) and resets ids, then creates: 1 admin, 2 receptionists, 3 specialties × 2 doctors, 6 rooms (each doctor keeps one room), 2 shifts, roster entries for the current and next week (Mon–Sat; mornings maxPatients 10, afternoons 6), 3 patients, and 2 BOOKED appointments in doctor 1's next morning shift after today (queue 1 and 2, `nextQueueNumber` set to 3). All passwords: `password123`.

## Dev scenario seed (`server/prisma/seed-today.ts`, `npm run db:seed:today -w server`)

Dev only (refuses `NODE_ENV=production`); run after the main seed. For **today** (any weekday): upserts Morning (max 10) and Afternoon (max 6) roster entries for doctor1 (room A1-01) and doctor3 (room A1-03), deletes those entries' appointments/notes and resets `nextQueueNumber` to 1, upserts patients 4–6 (`patient4@example.com`…, phones `091100000x`), then creates 11 appointments **through `BookingService` / `AppointmentService` with fixed clocks** (booked 06:00; check-ins 07:15 / 07:20 / 12:30; one patient cancel at 06:30; one note): 7 BOOKED, 3 CHECKED_IN, 1 CANCELLED. Idempotent for today's data.
