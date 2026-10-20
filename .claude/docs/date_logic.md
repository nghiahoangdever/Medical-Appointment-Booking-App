# Date and time logic

Server: `server/src/domain/time.ts`. Client: `client/src/lib/date.ts`. Tests: `server/tests/time.test.ts`, `booking.domain.test.ts`.

## Storage

| Kind           | Format                                                 | Where                                                                                                               |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Calendar date  | `"YYYY-MM-DD"` string                                  | `RosterEntry.date`, `PatientProfile.dateOfBirth`, API fields named `date` / `dateOfBirth`                           |
| Time of day    | `"HH:mm"` string (24h, zero-padded)                    | `Shift.startTime`, `Shift.endTime`                                                                                  |
| Moment in time | Prisma `DateTime` (serialized to ISO 8601 UTC in JSON) | `bookedAt`, `checkedInAt`, `startedAt`, `completedAt`, `cancelledAt`, `User.createdAt`, `AppointmentNote.createdAt` |

Zero-padded strings compare correctly with `<`, `>`, `===` — the code relies on that (`date < window.first`, `timeOfDay(now) >= startTime`). Never store calendar dates as `DateTime`.

## Timezone

Single clinic timezone, **not configured anywhere**: the server uses the Node process's local time (`new Date()` getters), the client uses the browser's local time. Both are assumed to be the clinic's timezone. `toDateString` uses local getters, never `toISOString()` (which would shift dates across midnight UTC).

## Server helpers (`domain/time.ts`)

| Function                                 | Behaviour                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `type Clock = () => Date`, `systemClock` | Inject into services; tests pass a fixed clock                                                                          |
| `toDateString(date)`                     | local `YYYY-MM-DD`                                                                                                      |
| `today(now = new Date())`                | `toDateString(now)`                                                                                                     |
| `timeOfDay(now)`                         | local `HH:mm`                                                                                                           |
| `addDays(date, n)`                       | calendar arithmetic, handles month/year rollover                                                                        |
| `dayOfWeek(date)`                        | 0 = Monday … 6 = Sunday                                                                                                 |
| `startOfWeek(date)`                      | Monday of that week                                                                                                     |
| `isValidDateString(s)`                   | format + real calendar date (`2026-02-30` → false)                                                                      |
| `hasTimePassed(date, time, now)`         | `date < today` OR (`date === today` AND `HH:mm(now) >= time`) — inclusive: at exactly 07:30 the 07:30 shift has started |

zod: `dateString()` in `server/src/validation.ts` validates with `isValidDateString` → error code `DATE_INVALID`.

## Rules built on these

| Rule                                              | Check                                                                                                                | Status                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Booking window                                    | `today ≤ date ≤ today + 13` (`bookingWindow(now)`, `BOOKING_WINDOW_DAYS = 14`)                                       | implemented                                |
| Can't book a started shift                        | `hasTimePassed(date, shift.startTime, now)` → `SHIFT_ALREADY_STARTED`                                                | implemented                                |
| Availability status `STARTED`                     | same check per day/shift                                                                                             | implemented                                |
| Patient cancel deadline                           | `hasTimePassed(date, shift.startTime, now)` → `CANCEL_DEADLINE_PASSED`                                               | implemented                                |
| Date of birth not in future                       | `dateOfBirth <= today()` → `DATE_OF_BIRTH_IN_FUTURE`                                                                 | implemented                                |
| Check-in only on the visit date, before shift end | `date === today(now)` (`CHECK_IN_NOT_TODAY`) and `!hasTimePassed(date, shift.endTime, now)` (`CHECK_IN_SHIFT_ENDED`) | implemented (`domain/appointmentRules.ts`) |
| No-show only after shift start                    | `hasTimePassed(date, shift.startTime, now)` (`NO_SHOW_TOO_EARLY`)                                                    | implemented (`domain/appointmentRules.ts`) |

The cancel / check-in / no-show rules live only in `domain/appointmentRules.ts`; the API sends the result as `allowedActions`.

## Client helpers (`client/src/lib/date.ts`)

| Function                         | Output                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `todayIso()`                     | local `YYYY-MM-DD`                                                                   |
| `formatDate("2026-10-20")`       | `20/10/2026`                                                                         |
| `formatDayMonth`                 | `20/10`                                                                              |
| `weekday` / `weekdayShort`       | `Thứ Ba` / `T3` (`CN` for Sunday)                                                    |
| `formatDateLong`                 | `Thứ Ba, 20/10/2026`                                                                 |
| `formatDateTime(isoTimestamp)`   | `08:05 20/10/2026` (local time)                                                      |
| `parseDisplayDate("20/10/2026")` | `2026-10-20`; accepts `/`, `-`, `.` and 1-digit day/month; `null` if not a real date |
| `addDays(date, n)`               | calendar arithmetic (reception day navigator)                                        |
| `ageOn(dateOfBirth, onDate)`     | whole years (patient details)                                                        |

The client has **no** time-based business rules (no `hasTimePassed`): whether an action is possible comes from the server's `allowedActions`. `todayIso()` (browser clock) is only used for display defaults: the reception page's initial day and the patient's upcoming/past split.

User-facing dates are always `dd/MM/yyyy`. Date inputs are text fields with placeholder `dd/mm/yyyy` parsed by `parseDisplayDate` — not `<input type="date">`, whose display format depends on the browser locale.

## Server clock in the running app (`src/clock.ts`)

Service singletons use `appClock`:

- default: the system clock;
- **dev only**: `DEV_FAKE_NOW="HH:mm"` in `server/.env` → an offset clock that starts at that time **today** (real date) and keeps running. Format is validated (`/^([01]\d|2[0-3]):[0-5]\d$/`); empty string = off; `config.ts` refuses it when `NODE_ENV=production`; tests never load `.env`. The server logs a `[dev] DEV_FAKE_NOW=…` warning at startup.
- `GET /api/health` returns `{ now, fakeClock }`; the client's `DevClockBanner` (dev builds only) shows an amber bar with the simulated time when `fakeClock` is true.
- `.env` is read at startup only: restart `npm run dev` after changing it.
- DB defaults (`@default(now())`) use real time. App code passes the service clock's `now` for every timestamp it writes (`bookedAt`, `checkedInAt`, `cancelledAt`, note `createdAt`) so data stays consistent under a fake clock.

### Manual testing recipe (any hour)

1. `npm run db:seed -w server` then `npm run db:seed:today -w server` — today gets Morning + Afternoon entries for doctor1 (Nội tổng quát) and doctor3 (Nhi khoa) with BOOKED / CHECKED_IN / CANCELLED appointments, created through the services.
2. Set `DEV_FAKE_NOW` and restart `npm run dev`. Expected reception buttons for BOOKED cards:

| `DEV_FAKE_NOW` | Morning (07:30–11:30)   | Afternoon (13:00–17:00) |
| -------------- | ----------------------- | ----------------------- |
| `06:00`        | Check-in, Hủy           | Check-in, Hủy           |
| `09:00`        | Check-in, Vắng mặt, Hủy | Check-in, Hủy           |
| `12:00`        | Vắng mặt, Hủy           | Check-in, Hủy           |
| `18:00`        | Vắng mặt, Hủy           | Vắng mặt, Hủy           |

3. Set `DEV_FAKE_NOW=""` and restart to return to real time.

## Testing with time

- Service tests: `new BookingService(..., () => new Date(2026, 9, 20, 9, 0))` (month is 0-based → 20/10/2026 09:00 local, a Tuesday). At that time the 07:30 shift has started and the 13:00 shift has not.
- Guard tests (`appointmentRules.test.ts`) call `guardFailure` / `allowedActions` directly with chosen `now` values, including the exact boundary minutes (07:29/07:30, 11:29/11:30).
- API tests use the real clock and build dates with `addDays(today(), n)`; use future dates (e.g. tomorrow) so shift-start rules don't make them flaky.
- The seed builds the roster from `startOfWeek(today())`, so demo data goes stale: re-run `npm run db:seed -w server` to roll it forward.
