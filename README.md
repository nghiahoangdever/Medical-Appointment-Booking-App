# MediSchedule

Appointment booking for a multi-specialty clinic, built for a Software Analysis & Design course. The code is laid out so each part matches a UML diagram (use case, class, state, sequence).

**Roles:** Patient · Receptionist · Doctor · Admin
**Stack:** React + Vite + Tailwind (client) · Express + Prisma + SQLite (server) · JWT auth · TypeScript throughout

## Getting started

Requires Node.js 20+ (developed on 24 LTS).

```bash
npm install                          # installs server + client (npm workspaces)
cp server/.env.example server/.env   # skip if server/.env already exists
npm run db:setup                     # create prisma/dev.db, apply migrations, seed demo data
npm run dev                          # API on :4000, web app on http://localhost:5173
```

> npm 11+ asks before running dependency install scripts. Prisma and esbuild need theirs. They are pre-approved under `allowScripts` in `package.json`. If Prisma complains about missing engines, run `npm rebuild prisma @prisma/engines @prisma/client esbuild`.

### Demo accounts

Every seeded account uses the password **`password123`**. In development, the login page lists them and fills them in when you click one.

| Role         | Login                                                        |
| ------------ | ------------------------------------------------------------ |
| Admin        | `admin@medischedule.local`                                   |
| Receptionist | `reception1@medischedule.local`, `reception2@…`              |
| Doctor       | `doctor1@medischedule.local` … `doctor6@…` (2 per specialty) |
| Patient      | `patient1@example.com` … `patient3@…`                        |

The seed creates a duty roster for **this week and next** (Mon–Sat, Morning 07:30–11:30 / Afternoon 13:00–17:00) and two bookings for the first doctor's next morning shift (patients 1 and 2). To roll the dates forward, run `npm run db:seed -w server` again. It wipes and reseeds everything.

## Language conventions

- **UI text is Vietnamese.** Code, identifiers, API routes and database values stay English.
- **The server returns error codes, not user text.** Errors look like `{ code: "SHIFT_FULL", message: "<English, for developers>" }`, and validation errors carry per-field codes: `details: [{ path: "email", code: "EMAIL_INVALID" }]`. Zod schemas use codes as their messages (`server/src/validation.ts`).
- **The client translates codes** in one place, `client/src/i18n/errors.ts`. Enum values get Vietnamese labels in `client/src/i18n/labels.ts` (for example `BOOKED` → "Đã đặt", `CHECKED_IN` → "Đã check-in", `Morning` → "Ca sáng").
- **Dates are shown as dd/MM/yyyy** (`client/src/lib/date.ts`). The API sends calendar dates as `YYYY-MM-DD`. Date of birth is typed as dd/mm/yyyy and converted before sending.
- **Seed display content** (specialty and room names, people's names) is Vietnamese. Shift names (`Morning`/`Afternoon`) are fixed identifiers that the client translates.

## Scripts

| Command (repo root)               | What it does                                                           |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                     | Run API and client together                                            |
| `npm test`                        | Server tests (Vitest + supertest, against a separate `prisma/test.db`) |
| `npm run typecheck`               | `tsc --noEmit` for server and client                                   |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                      |
| `npm run db:setup`                | Migrate + seed                                                         |
| `npm run db:reset -w server`      | Drop the dev DB, re-run migrations and seed                            |
| `npm run db:studio -w server`     | Browse data in Prisma Studio                                           |

## Architecture

```
Route → Controller → Service → Repository → SQLite (Prisma)
            ↑            ↑           ↑
            └──────── domain/ (enums, errors, state machine, date helpers) ────────┘
```

- **Controller:** HTTP only. Validates input with zod and turns results into JSON.
- **Service:** business rules and transactions. Throws `AppError`s (`domain/errors.ts`).
- **Repository:** the only layer that talks to Prisma.
- **domain/:** plain TypeScript with no framework imports. Every layer can use it.
- Every error response has the shape `{ "error": { "code", "message", "details?" } }` (`middleware/errorHandler.ts`).
- **Time-dependent services take a `Clock`** (`domain/time.ts`), so tests can fix "now" (for example "09:00, the morning shift has started").
- **Booking runs in one transaction** (`db/prisma.ts runInTransaction`). `DATABASE_URL` uses `connection_limit=1`, so concurrent bookings are serialized and can't overbook or repeat a queue number. A test fires 6 bookings at a 3-place shift to check this.

```
server/
  prisma/            schema.prisma (class diagram), migrations/, seed.ts
  src/
    domain/          enums.ts, errors.ts, time.ts, booking.ts, appointmentStateMachine.ts
    middleware/      authenticate.ts, requireRole.ts, errorHandler.ts
    modules/<area>/  <area>.routes.ts · .controller.ts · .service.ts · .repository.ts
    validation.ts    shared zod pieces (error-code messages)
    app.ts           builds the Express app (used by server.ts and tests)
  tests/
client/src/
  api/               fetch wrapper (JWT, ApiError) + one file per resource
  auth/              AuthContext, ProtectedRoute, role → home page
  i18n/              Vietnamese labels and error-code messages
  lib/date.ts        dd/MM/yyyy formatting and parsing
  hooks/useApi.ts    load + refresh (+ optional polling)
  components/        Layout, AppointmentCard, StatusBadge, RefreshButton, ui/…
  pages/             auth/, patient/ (+ booking/ wizard), more per phase
```

### API (so far)

| Method & path                                     | Role                         | Use case     |
| ------------------------------------------------- | ---------------------------- | ------------ |
| `POST /api/auth/register`, `POST /api/auth/login` | public                       | UC-P1, login |
| `GET /api/auth/me`                                | any                          | session      |
| `GET /api/specialties`, `/:id/doctors`            | any                          | UC-P2        |
| `GET /api/availability?specialtyId&doctorId?`     | any                          | UC-P3        |
| `POST /api/appointments`                          | Patient                      | UC-P4        |
| `GET /api/appointments/mine`                      | Patient                      | UC-P5/P6     |
| `POST /api/appointments/:id/cancel`               | Patient, Receptionist, Admin | UC-P7/R4     |

`GET /api/availability` returns the **whole 14-day booking window** in one response (each day → shifts → places left), not a single date as the original sequence diagram said. The wizard can then gray out full or closed days without one request per day. In the "patient books" sequence diagram, step 3 becomes `GET /availability?specialtyId[&doctorId]`.

### Design → code map

| Design artifact                                | Where it lives                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Class diagram                                  | `server/prisma/schema.prisma`                                                                              |
| Enumerations (Role, Gender, AppointmentStatus) | `server/src/domain/enums.ts`                                                                               |
| Use cases                                      | one route + controller method each (e.g. UC-P1 Register → `POST /api/auth/register`)                       |
| Access control per actor                       | `authenticate` + `requireRole(...)` middleware                                                             |
| State diagram (appointment status)             | `server/src/domain/appointmentStateMachine.ts`: `TRANSITIONS` table, one row per arrow                     |
| Sequence: patient books an appointment         | `BookingService.book` in `server/src/modules/appointments/booking.service.ts` (steps numbered in comments) |
| Booking rules (window, capacity, auto-assign)  | `server/src/domain/booking.ts`                                                                             |

## Status

- [x] **Phase 0:** scaffolding (workspaces, Express, Vite, Tailwind, Prisma, ESLint/Prettier, Vitest)
- [x] **Phase 1:** data model, seed data, patient registration, login (email or phone), JWT, role-based routing
- [x] **Vietnamese UI:** error codes from the server, translations in the client, dd/MM/yyyy dates
- [x] **Phase 2:** patient booking (availability, booking wizard, my appointments, cancel), appointment state machine
- [ ] Phase 3: reception (day list, search, check-in, cancel, no-show, notes)
- [ ] Phase 4: doctor queue (call next, complete, no-show, notes, polling)
- [ ] Phase 5: admin management (specialties, rooms, staff, shift times, weekly roster)
- [ ] Phase 6: polish and end-to-end tests
