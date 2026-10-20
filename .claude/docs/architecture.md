# Architecture

## Layers (server)

```
Route → Controller → Service → Repository → Prisma → SQLite
                 ↘        ↘          ↘
                   domain/  (no framework imports; usable from every layer)
```

| Layer             | Responsibility                                                                                               | Must not                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `*.routes.ts`     | Wire HTTP paths to controller methods; attach `authenticate` / `requireRole(...)`                            | Contain logic                              |
| `*.controller.ts` | Parse input with zod (`schema.parse(req.body / req.query / req.params)`), call one service method, send JSON | Touch Prisma, enforce business rules       |
| `*.service.ts`    | Business rules, transactions (`runInTransaction`), throw `AppError`s                                         | Read `req`/`res`, import `prisma` directly |
| `*.repository.ts` | All Prisma queries; accept an optional `db: Db = prisma` so they can run inside a transaction                | Enforce business rules                     |
| `domain/`         | Enums, errors, date helpers, booking rules, appointment state machine, appointment guards                    | Import Express, Prisma, zod                |

Rules:

- Only repositories (and `runInTransaction` in `src/db/prisma.ts`) import `prisma`.
- Services, controllers and repositories are **classes**. Each module exports a singleton built with constructor injection (e.g. `new BookingService(rosterRepository, appointmentRepository, shiftRepository)`); controllers are constructed in the module's routes file. Controller methods are arrow-function properties so they can be passed to Express directly.
- Time-dependent services take a `clock: Clock` constructor parameter (`domain/time.ts`). The exported singletons get `appClock` from `src/clock.ts` (system clock, or the dev-only `DEV_FAKE_NOW` clock); tests construct services with fixed clocks.
- Express 5 forwards rejected promises from async handlers to `errorHandler`; do not wrap handlers in try/catch.
- Appointment status is changed only via `transition()` + `guardFailure()` → see `appointment_state_machine.md`.
- **Views are per viewer**: `appointment.mapper.ts` builds `AppointmentView` for patients and `StaffAppointmentView` (+ `patient`, `notes`) for staff (`toViewFor(record, viewer, now)`). Both include `allowedActions` computed for that viewer at that moment.
- **No business rules in the client**: buttons are rendered from `allowedActions`; the client has no copy of time/ownership rules.

## Folder structure

```
package.json                 npm workspaces: server, client; root scripts
server/
  .env / .env.example        DATABASE_URL (must end in ?connection_limit=1), PORT, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGIN,
                             DEV_FAKE_NOW (dev only, "HH:mm" or empty)
  prisma/schema.prisma       data model (= class diagram)
  prisma/migrations/         committed migrations
  prisma/seed.ts             idempotent demo seed (wipes all tables first)
  prisma/seed-today.ts       dev only: today's reception scenarios, created through the real services
  src/
    server.ts                listen on config.PORT
    app.ts                   createApp(): cors, express.json, routers, notFoundHandler, errorHandler
    config.ts                zod-validated env; loads server/.env unless NODE_ENV=test; rejects DEV_FAKE_NOW in production
    clock.ts                 appClock (system clock or DEV_FAKE_NOW offset clock), isFakeClock
    validation.ts            shared zod builders: dateString(), id()
    db/prisma.ts             prisma client, Db type, runInTransaction (maxWait 5s, timeout 10s)
    domain/                  enums.ts, errors.ts, time.ts, booking.ts, appointmentStateMachine.ts,
                             appointmentRules.ts (Actor, guardFailure, allowedActions)
    middleware/              authenticate.ts (+ getAuthUser), requireRole.ts, errorHandler.ts (+ notFoundHandler)
    types/express.d.ts       adds req.user: { id, role }
    modules/
      auth/                  auth.routes / auth.controller / auth.service / token.ts (sign/verify JWT)
      users/                 user.repository
      specialties/           specialty.routes / .controller / .service / .repository
      doctors/               doctor.repository
      shifts/                shift.routes / .controller / .service / .repository
      roster/                roster.repository (findSlots, takeNextQueueNumber)
      availability/          availability.routes / .controller / .service
      appointments/          appointment.routes / .controller / booking.service / appointment.service /
                             appointment.repository (findForStaff, countByStatus, updateStatus, …) /
                             note.repository / appointment.mapper (AppointmentView, StaffAppointmentView)
  tests/                     vitest; globalSetup.ts, helpers/db.ts (resetDatabase), helpers/fixtures.ts
  vitest.config.ts           test env: DATABASE_URL=file:./test.db?connection_limit=1, fileParallelism: false
client/
  vite.config.ts             proxy /api → http://localhost:4000
  src/
    main.tsx, App.tsx        routes (react-router 7, imported from 'react-router')
    api/http.ts              fetch wrapper: relative /api URLs, Bearer token, throws ApiError(status, code, message, details)
    api/auth.ts              authApi
    api/appointments.ts      appointmentsApi: book, mine, listForStaff, addNote, cancel, checkIn, markNoShow
    api/booking.ts           reference data: specialtiesApi, shiftsApi, availabilityApi
    auth/                    AuthContext (useAuth), ProtectedRoute({ roles? }), roles.ts (ROLE_HOME), tokenStorage.ts
    hooks/useApi.ts          useApi(load | null, { pollMs?, keepData? }) → { data, setData, error, loading, refresh }
    i18n/                    labels.ts (enum → Vietnamese), errors.ts (error code → Vietnamese)
    lib/date.ts              dd/MM/yyyy formatting/parsing, addDays, ageOn (no business time rules)
    components/              Layout (nav per role + DevClockBanner), AppointmentCard (expandable; title/subtitle overridable),
                             CancelAppointment (shared patient/staff), PatientInfo, AppointmentNotes, StatusBadge,
                             RefreshButton, EmptyState, PageHeader, Logo,
                             ui/ (Button — defaults to type="button", FormField: TextField/SelectField/TextAreaField, Alert, PageSpinner)
    pages/                   auth/ (Login, Register), patient/ (MyAppointmentsPage, booking/ wizard),
                             reception/ (ReceptionPage, ReceptionActions, DayNavigator, StatusFilter),
                             RoleHome (placeholder dashboard for Doctor/Admin), NotFoundPage
    types/index.ts           API response shapes (hand-mirrored from server views)
```

New server feature = new or extended folder under `modules/` with the same four-file pattern. New client page = `pages/<role>/`, route in `App.tsx`, nav item in `components/Layout.tsx` (`NAV_ITEMS`).

## Request flow (example: `POST /api/appointments`)

1. `app.ts` → `appointmentRouter` (`appointment.routes.ts`)
2. `authenticate` verifies `Authorization: Bearer <jwt>`, sets `req.user = { id, role }` (401 `NOT_AUTHENTICATED` / `INVALID_TOKEN`)
3. `requireRole(Role.PATIENT)` (403 `FORBIDDEN`)
4. `AppointmentController.book` → `bookSchema.parse(req.body)` (400 `VALIDATION_ERROR` with per-field codes)
5. `BookingService.book(patientId, input)` → repositories inside `runInTransaction`
6. Response `201 { appointment: AppointmentView }`
7. Any thrown error → `errorHandler` → `{ error: { code, message, details? } }` (see `i18n_and_errors.md`)

Auth: JWT signed with `JWT_SECRET`, `sub` = user id, payload `{ role }`, expiry `JWT_EXPIRES_IN` (default `8h`). Client stores it in `localStorage` key `medischedule.token`; any 401 on a request that carried a token logs the user out (`setUnauthorizedHandler`). No refresh tokens.

## API style

- Resource reads: `GET` returning `{ <resourceName>: ... }` (e.g. `{ specialties }`, `{ appointments }`, `{ appointment }`).
- **One action endpoint per state change**: `POST /api/appointments/:id/<action>`, never a generic `PATCH status`. Each endpoint = one use case = one transition-table action.
- Controllers wrap single appointments as `{ appointment }`; availability returns the object directly.

### Endpoints

| Method & path                                                                                                                                                                  | Roles                            | Status            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ----------------- |
| `GET /api/health` → `{ status, now, fakeClock }`                                                                                                                               | public                           | implemented       |
| `POST /api/auth/register` (patients only)                                                                                                                                      | public                           | implemented       |
| `POST /api/auth/login` (`identifier` = email or phone)                                                                                                                         | public                           | implemented       |
| `GET /api/auth/me`                                                                                                                                                             | any logged-in                    | implemented       |
| `GET /api/specialties`                                                                                                                                                         | any logged-in                    | implemented       |
| `GET /api/specialties/:id/doctors`                                                                                                                                             | any logged-in                    | implemented       |
| `GET /api/shifts`                                                                                                                                                              | any logged-in                    | implemented       |
| `GET /api/availability?specialtyId&doctorId?`                                                                                                                                  | any logged-in                    | implemented       |
| `POST /api/appointments`                                                                                                                                                       | PATIENT                          | implemented       |
| `GET /api/appointments/mine`                                                                                                                                                   | PATIENT                          | implemented       |
| `GET /api/appointments?date&shiftId&specialtyId&doctorId&status&q` → `{ appointments, counts }` (`date` or `q` required; `q` = part of code or phone, all dates; max 200 rows) | RECEPTIONIST, ADMIN              | implemented       |
| `POST /api/appointments/:id/cancel` (body `{ reason? }` optional)                                                                                                              | PATIENT, RECEPTIONIST, ADMIN     | implemented       |
| `POST /api/appointments/:id/check-in`                                                                                                                                          | RECEPTIONIST                     | implemented       |
| `POST /api/appointments/:id/no-show`                                                                                                                                           | RECEPTIONIST (DOCTOR in Phase 4) | implemented       |
| `POST /api/appointments/:id/notes` (body `{ content }`, 1–1000 chars) → 201                                                                                                    | RECEPTIONIST (DOCTOR in Phase 4) | implemented       |
| `POST /api/appointments/:id/start`, `/complete`                                                                                                                                | DOCTOR                           | planned (Phase 4) |
| `GET /api/doctor/queue`, `POST /api/roster-entries/:id/call-next`                                                                                                              | DOCTOR                           | planned (Phase 4) |
| Admin CRUD (specialties, rooms, doctors, receptionists, shifts, roster)                                                                                                        | ADMIN                            | planned (Phase 5) |

## Testing

- `server/tests/`, Vitest + supertest against `createApp()`. No client tests yet.
- `globalSetup.ts` deletes and recreates `server/prisma/test.db` via `prisma migrate deploy` once per run; `dev.db` is never touched.
- Each test file calls `resetDatabase()` in `beforeEach` and builds data with `helpers/fixtures.ts` (`createClinic`, `createPatient`, `createStaff`, `addRoster`, `bearer(user)`).
- Service-level tests use fixed clocks (`new BookingService(..., () => new Date(2026, 9, 20, 9, 0))`, `new AppointmentService(appointmentRepository, noteRepository, clock)`); API tests use the real clock with dates relative to `today()`.
- Guards are tested as pure functions in `appointmentRules.test.ts`; reception flows in `reception.service.test.ts` (fixed clocks) and `reception.api.test.ts` (HTTP).
