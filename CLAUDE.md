# MediSchedule — CLAUDE.md

## 1. Project Overview

MediSchedule is an appointment booking web app for a multi-specialty clinic with four roles: Patient, Receptionist, Doctor, Admin. Patients book by specialty, optional doctor, date and shift and get an appointment code and queue number; reception checks them in and doctors work through their shift queue.
It is a solo, **design-first** Software Analysis & Design course project: the code must mirror the UML use case, class, state and sequence diagrams. Design clarity beats feature count.
It targets **desktop web browsers only (1280px wide and up)**; mobile and responsive layouts are out of scope.

## 2. Tech Stack

Node.js 24 LTS (README minimum: 20+). npm workspaces: `server/`, `client/`. TypeScript 5.9 everywhere.

**Server** (`server/`)

- Express 5.3, zod 4.6 (validation), Prisma 6.19 + SQLite (`server/prisma/dev.db`)
- Auth: jsonwebtoken 9 (Bearer JWT, 8h), bcryptjs 3
- Runs via tsx 4 (no compile step); tests: Vitest 3.2 + supertest 7

**Client** (`client/`)

- React 19.3, React Router 7.18 (import from `react-router`), Vite 7.3, Tailwind CSS 4.3 (`@tailwindcss/vite`)
- No state or data-fetching library: `AuthContext` + `hooks/useApi.ts`

**Tooling** (root): ESLint 9 (flat config, typescript-eslint), Prettier 3 (single quotes, width 100), concurrently 9.

## 3. Dev Commands

Run from the repo root unless noted.

| Task                                                | Command                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Install (also runs `prisma generate`)               | `npm install`                                                                                 |
| First-time env                                      | `cp server/.env.example server/.env`                                                          |
| Create DB + migrate + seed                          | `npm run db:setup`                                                                            |
| Run API (:4000) + client (http://localhost:5173)    | `npm run dev`                                                                                 |
| Run all server tests                                | `npm test`                                                                                    |
| Run one test file                                   | `npm test -w server -- tests/booking.service.test.ts`                                         |
| Watch tests                                         | `npm run test:watch -w server`                                                                |
| Type-check server + client                          | `npm run typecheck`                                                                           |
| Lint / format                                       | `npm run lint` / `npm run format`                                                             |
| New migration after editing `schema.prisma`         | `npm run db:migrate -w server -- --name <change>`                                             |
| Re-seed (wipes all data, rolls roster to this week) | `npm run db:seed -w server`                                                                   |
| Dev only: fill today with reception scenarios       | `npm run db:seed:today -w server` (after `db:seed`; resets today's queue for doctor1/doctor3) |
| Drop DB, re-migrate, re-seed                        | `npm run db:reset -w server`                                                                  |
| Browse data                                         | `npm run db:studio -w server`                                                                 |
| Build client                                        | `npm run build -w client` (server has no build; `npm run start -w server` runs it with tsx)   |

- Demo accounts (all `password123`): `admin@medischedule.local`, `reception1@medischedule.local`, `doctor1@medischedule.local`…`doctor6@…`, `patient1@example.com`…`patient3@…` (4–8 after `db:seed:today`). The admin lands on the roster editor (`/admin/roster`).
- Tests use `server/prisma/test.db`, recreated each run; they never touch `dev.db`.
- npm 11 blocks dependency install scripts unless listed in `allowScripts` (root `package.json`). Prisma and esbuild are approved; a new dependency with install scripts needs `npm install-scripts approve <pkg>` — ask first.
- Before declaring work done: `npm run typecheck`, `npm run lint`, `npm test` all pass.

### Simulated clock (dev only, for time-based rules)

Use it to test check-in (only before shift end), no-show (only after shift start) and the doctor queue at any hour:

1. `npm run db:seed -w server` then `npm run db:seed:today -w server`. This gives today's queues for doctor1 and doctor3; doctor3's morning is mid-shift.
2. Set `DEV_FAKE_NOW="09:00"` in `server/.env` and restart `npm run dev`. The server acts as if it were that time **today**, time keeps running, and the UI shows an amber banner.
3. Reception: try `06:00` (nothing started), `09:00` (morning running), `12:00` (morning ended), `18:00` (both ended). Doctor (`doctor3@…`): try `07:00`, `09:00`, `12:50`, `18:00`. The expected buttons for each time are in `.claude/docs/date_logic.md`.
4. Reset with `DEV_FAKE_NOW=""` and restart. Never commit `server/.env`. The server refuses the setting in production, and tests ignore it (they inject fixed clocks).

## 4. Core Logic Summary

- **Roster**: `RosterEntry` = doctor + room + date + shift (`Morning` 07:30–11:30 / `Afternoon` 13:00–17:00) + `maxPatients`.
- **Capacity**: used = appointments in the entry with any status except `CANCELLED`; booking fails with `SHIFT_FULL` when used ≥ `maxPatients`.
- **Queue numbers**: taken from `RosterEntry.nextQueueNumber` at booking (atomic increment), never reused; cancellations leave gaps.
- **Doctor assignment**: no doctor chosen → the on-duty doctor of the specialty with free capacity and the fewest active bookings; tie → lowest doctor id.
- **Booking**: one transaction; window is today + 13 days; started shifts can't be booked; one active appointment per patient per date + shift.
- **State machine**: `BOOKED → CHECKED_IN → IN_EXAMINATION → COMPLETED`, alternative endings `CANCELLED`, `NO_SHOW`. Every change goes through `transition()` in `server/src/domain/appointmentStateMachine.ts`.
- **Guards** (`server/src/domain/appointmentRules.ts`):
  - check-in only on the appointment date, before shift end;
  - no-show only after shift start;
  - patients cancel only their own appointments, before shift start;
  - doctors act only on their own roster entries;
  - an exam starts only on the appointment date (it may start before the shift's start time);
  - a doctor examines one patient at a time across all their shifts that day.

  Every appointment response carries `allowedActions` (state machine + guards for the viewer); the UI shows only those buttons.

- **Doctor queue**: call order is the lowest `queueNumber` among CHECKED_IN. "Call next" = `QueueService.callNext` → `AppointmentService.start`.
- **Roster rules** (`server/src/domain/rosterRules.ts` + `RosterService`):
  - one entry per doctor, and one per room, per date + shift;
  - only active doctors and rooms can be rostered;
  - past days are read-only;
  - `maxPatients` can't go below the active bookings;
  - an entry can be deleted only if it never had an appointment;
  - "copy previous week" skips what can't be placed and reports why.
- **Auth**: every authenticated request re-checks the account. Deactivated accounts get `ACCOUNT_DISABLED` immediately, and the role comes from the DB.
- **Soft delete**: specialties, rooms and accounts are deactivated, never deleted. Deactivation is blocked while appointments from today on are still open. Bookings only go to entries whose doctor, room and specialty are all active.

## 5. Key Constraints

Never change or assume otherwise without asking the user:

- **Layering**: routes → controllers → services → repositories → Prisma. Controllers do HTTP + zod only; services hold the rules; only repositories import `prisma`. `server/src/domain/` has no framework imports.
- **Appointment status**: never set `status` outside the state machine. Use `transition(from, action, role)`, then `guardFailure(...)`, then `AppointmentRepository.updateStatus(id, from, data)` (see `AppointmentService.perform`). New arrows go in `TRANSITIONS` and its test.
- **No business rules in the client**: time/ownership rules live only on the server; the client reads `allowedActions`.
- **One action endpoint per state change** (`POST /api/appointments/:id/cancel`, `/check-in`, …); no generic status PATCH.
- **Language**: UI text in Vietnamese; code, identifiers, comments, API routes, database values and server messages in English.
- **Desktop only**: build for ≥1280px desktop browsers; no breakpoint variants (`sm:`, `md:`…) or mobile-specific UI in new code. Tables and multi-column layouts are fine.
- **File editing**: edit files only with the Edit/Write tools, never with PowerShell text replacement (`Get-Content`/`Set-Content`/`-replace`). Always keep files as UTF-8 without BOM. PowerShell 5.1 reads files as ANSI and turns Vietnamese text into mojibake.
- **Errors**: the server returns error codes only (`{ error: { code, message, details?[{ path, code }] } }`; `message` is English and for developers). zod messages are codes. The client maps codes to Vietnamese in `client/src/i18n/errors.ts` and enum values in `client/src/i18n/labels.ts`. Never show `message` or raw enum values.
- **Dates**: stored as `YYYY-MM-DD` and `HH:mm` strings (local clinic time, no TZ conversion); displayed as `dd/MM/yyyy` via `client/src/lib/date.ts`. Time-dependent services take an injectable `Clock`.
- **Database**: `DATABASE_URL` must keep `?connection_limit=1`; it serializes booking transactions (no overbooking, no duplicate queue numbers). Schema changes need a migration.
- **Git**: never commit, push, merge or change git config without asking.
- **Branches**: `master` is the main branch. Never commit directly on it. Before adding a feature or fixing a bug, create a new branch from `master`:
  - features: `feature/<short-desc>` (e.g. `feature/phase-3-reception`)
  - bug fixes: `bug/<short-desc>` (e.g. `bug/cancel-after-shift-start`)
    Use lowercase and hyphens. Merge back into `master` only after I've tested and approved.
- **Process**: work one phase at a time and stop for review after each. If the design changes (endpoints, entities, transitions, sequence steps, names), update `.claude/docs/design_mapping.md` (Design change log) and tell the user which UML diagram to update.

- Don't document or claim features that aren't implemented; mark them "planned".

## 6. Current Status

- Phase 0 – Scaffolding: **done**.
- Phase 1 – Data model, seed, registration, login/JWT, role routing: **done**.
- Vietnamese UI + error-code translation + dd/MM/yyyy dates: **done**.
- Phase 2 – Patient booking (availability, wizard, my appointments, cancel), state machine: **done** (commit `5c11a9a`).
- Phase 3 – Reception (day list + filters, search, check-in, no-show, staff cancel, notes, patient details, `allowedActions`, dev simulated clock): **done**.
- Phase 4 – Doctor queue (duty schedule, shift queue, call next, start, complete, doctor no-show + notes, ownership and one-patient-per-doctor guards, 15 s polling; desktop-only scope): **done**.
- Phase 5 – Admin (specialties, rooms, doctor/receptionist accounts with activate/deactivate, shift times, weekly roster editor with conflict/capacity/delete rules, copy previous week, all-appointments overview, account-active check on every request): **done**. Known limitation: a booked shift can't be reassigned to another doctor.
- Phase 6 – Polish (retryable error + empty states, error boundary, session-ended message, `e2e.flow.test.ts`, PlantUML in `docs/uml/`, README design map + known limitations): **done**. Mobile is out of scope.
- **All phases (0–6) are done.** Further work (see README "Known limitations" / "Future work") needs a new `feature/…` branch and the user's go-ahead.

## 7. Additional Documentation

- [.claude/docs/architecture.md](.claude/docs/architecture.md): read before adding a module, endpoint, page or test (layers, folders, request flow, endpoint list, test setup).
- [.claude/docs/data_model.md](.claude/docs/data_model.md): read before touching `schema.prisma`, the seed, or writing queries (entities, relations, unique constraints, soft delete).
- [.claude/docs/appointment_state_machine.md](.claude/docs/appointment_state_machine.md): read before any status-changing feature (transition table, roles, guards, update pattern).
- [.claude/docs/booking_and_queue.md](.claude/docs/booking_and_queue.md): read before changing booking, availability, capacity, queue numbers, doctor assignment or roster rules.
- [.claude/docs/date_logic.md](.claude/docs/date_logic.md): read before any date/time comparison, display, or time-dependent test.
- [.claude/docs/i18n_and_errors.md](.claude/docs/i18n_and_errors.md): read before adding UI text, an error code, or a validation rule.
- [.claude/docs/design_mapping.md](.claude/docs/design_mapping.md): read before starting a phase and after any design change (use cases, classes, states, sequences → code; change log).
- `docs/uml/*.puml`: the UML diagrams as PlantUML, rendered to `docs/uml/svg/`. Keep them in step with the code when a design change touches them, and re-export the SVGs (README "Re-rendering").
