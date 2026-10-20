# i18n and errors

Rule: **UI text is Vietnamese. Code, identifiers, API routes, database values, log/developer messages are English.** The server never sends user-facing text; it sends codes.

## Error response shape (server)

```json
{ "error": { "code": "SHIFT_FULL", "message": "This shift is fully booked" } }
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.",
             "details": [{ "path": "email", "code": "EMAIL_INVALID" }] } }
```

- `code`: UPPER_SNAKE_CASE, what the client translates.
- `message`: English, for developers/logs only. The client never displays it.
- Produced only by `server/src/middleware/errorHandler.ts`:
  - `AppError` (thrown via `badRequest` 400 / `unauthorized` 401 / `forbidden` 403 / `notFound` 404 / `conflict` 409 from `domain/errors.ts`) → its status and code;
  - `ZodError` → 400 `VALIDATION_ERROR` + `details`. Each detail's code is the zod issue message if it matches `^[A-Z][A-Z0-9_]*$`; otherwise `REQUIRED` for `invalid_type`, else `INVALID_VALUE`;
  - Prisma `P2002` → 409 `ALREADY_EXISTS`; malformed JSON body → 400 `INVALID_JSON`; unknown route → 404 `ROUTE_NOT_FOUND`; anything else → 500 `INTERNAL_ERROR` (logged with `console.error`).
- Zod convention: **every custom message is an error code**, e.g. `z.string().min(8, 'PASSWORD_TOO_SHORT')`. Shared builders in `server/src/validation.ts`: `dateString()` → `DATE_INVALID`, `id()` → `ID_INVALID`.

## Error codes in use

| Area                     | Codes                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General                  | `VALIDATION_ERROR`, `INVALID_JSON`, `ROUTE_NOT_FOUND`, `ALREADY_EXISTS`, `INTERNAL_ERROR`, `FORBIDDEN` (requireRole)                                                                                                                                                                                                                                                                                                   |
| Auth                     | `NOT_AUTHENTICATED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `EMAIL_TAKEN`, `PHONE_TAKEN`                                                                                                                                                                                                                                                                                                          |
| Booking                  | `SPECIALTY_NOT_FOUND`, `DOCTOR_NOT_FOUND`, `SHIFT_NOT_FOUND`, `DATE_IN_PAST`, `DATE_OUTSIDE_BOOKING_WINDOW`, `SHIFT_ALREADY_STARTED`, `DUPLICATE_BOOKING`, `NO_DOCTOR_ON_DUTY`, `SHIFT_FULL`                                                                                                                                                                                                                           |
| Appointments             | `APPOINTMENT_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `ACTION_NOT_ALLOWED_FOR_ROLE`, `CANCEL_DEADLINE_PASSED`, `NOT_YOUR_APPOINTMENT`, `APPOINTMENT_CHANGED`                                                                                                                                                                                                                                                           |
| Reception guards         | `CHECK_IN_NOT_TODAY`, `CHECK_IN_SHIFT_ENDED`, `NO_SHOW_TOO_EARLY`                                                                                                                                                                                                                                                                                                                                                      |
| Field (`details[].code`) | `REQUIRED`, `INVALID_VALUE`, `ID_INVALID`, `DATE_INVALID`, `NAME_REQUIRED`, `NAME_TOO_LONG`, `EMAIL_INVALID`, `PHONE_INVALID`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `DATE_OF_BIRTH_IN_FUTURE`, `GENDER_INVALID`, `ADDRESS_TOO_LONG`, `IDENTIFIER_REQUIRED`, `PASSWORD_REQUIRED`, `REASON_TOO_LONG`, `NOTE_REQUIRED`, `NOTE_TOO_LONG`, `DATE_OR_QUERY_REQUIRED` (path `date`), `STATUS_INVALID`, `QUERY_TOO_LONG` |
| Client-only              | `NETWORK_ERROR` (fetch failed), `PASSWORD_MISMATCH` (register form), `UNKNOWN_ERROR` (non-JSON error response; falls back to the generic message)                                                                                                                                                                                                                                                                      |

## Client translation (`client/src/i18n/errors.ts`)

- `MESSAGES: Record<code, Vietnamese>` — the only place codes become text. Unknown code → `Đã có lỗi xảy ra. Vui lòng thử lại.`
- `errorMessage(err)` → banner text for anything thrown by an API call.
- `fieldErrorMessages(err)` → `{ [fieldPath]: Vietnamese }` for form inputs.
- `translateError(code)` for client-side validation; `hasErrorCode(err, ...codes)` to branch UI on specific errors.
- `ApiError` (`client/src/api/http.ts`) carries `status`, `code`, `details: { path, code }[]`.

### Adding a new error

1. Throw it in the service: `throw conflict('NEW_CODE', 'English developer message')` (or use the code as a zod message).
2. Add `NEW_CODE: '<Vietnamese>'` to `MESSAGES` in `client/src/i18n/errors.ts`.
3. Assert the code (not the message) in tests: `expect(res.body.error.code).toBe('NEW_CODE')` or `.rejects.toMatchObject({ code: 'NEW_CODE' })`.
4. Add it to the table above.

## Labels for English values (`client/src/i18n/labels.ts`)

| Export             | Values                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `STATUS_LABEL`     | BOOKED `Đã đặt`, CHECKED_IN `Đã check-in`, IN_EXAMINATION `Đang khám`, COMPLETED `Hoàn thành`, CANCELLED `Đã hủy`, NO_SHOW `Vắng mặt` |
| `ROLE_LABEL`       | PATIENT `Bệnh nhân`, RECEPTIONIST `Lễ tân`, DOCTOR `Bác sĩ`, ADMIN `Quản trị viên`                                                    |
| `GENDER_LABEL`     | FEMALE `Nữ`, MALE `Nam`, OTHER `Khác`                                                                                                 |
| `shiftLabel(name)` | `Morning` → `Ca sáng`, `Afternoon` → `Ca chiều`, otherwise the name itself                                                            |
| `doctorName(d)`    | `${title} ${fullName}`, e.g. `BS.CKI Trần Thị Linh`                                                                                   |

Never render an enum value or shift name raw; always go through these.

## Other UI text

Page copy (headings, buttons, hints) is written inline in Vietnamese in the components — there is no catalog for it. Keep terminology consistent with existing pages: `Lịch hẹn`, `Mã lịch hẹn`, `Số thứ tự` / `STT`, `Ca khám`, `Chuyên khoa`, `Hủy lịch hẹn`, `Làm mới`, `Quay lại`, `Check-in`, `Vắng mặt`, `Ghi chú nội bộ`, `Thông tin bệnh nhân`, `Tất cả`. `client/index.html` has `lang="vi"`.

Role labels shown next to note authors use `ROLE_LABEL`. Success notices after reception actions name the patient and queue number, e.g. `Đã check-in cho Hoàng Văn An (STT 1).`

## Dates

Displayed as `dd/MM/yyyy` via `client/src/lib/date.ts`; never format dates ad hoc in components. Details: `date_logic.md`.
