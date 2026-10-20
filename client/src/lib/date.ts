// The API uses "YYYY-MM-DD" for calendar dates and ISO strings for timestamps.
// Everything shown to users is dd/MM/yyyy.

const pad = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function toLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** The Monday of the week containing `isoDate`. */
export function startOfWeekIso(isoDate: string): string {
  const d = toLocalDate(isoDate);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIsoDate(d);
}

/** "2026-10-19", "2026-10-25" → "19/10 – 25/10/2026" */
export function formatDateRange(from: string, to: string): string {
  return `${formatDayMonth(from)} – ${formatDate(to)}`;
}

/** "2026-10-20" → "20/10/2026" */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-10-20" → "20/10" */
export function formatDayMonth(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

/** "2026-10-20" → "Thứ Ba" */
export function weekday(isoDate: string): string {
  return WEEKDAYS[toLocalDate(isoDate).getDay()];
}

/** "2026-10-20" → "T3" */
export function weekdayShort(isoDate: string): string {
  return WEEKDAYS_SHORT[toLocalDate(isoDate).getDay()];
}

/** "2026-10-20" → "Thứ Ba, 20/10/2026" */
export function formatDateLong(isoDate: string): string {
  return `${weekday(isoDate)}, ${formatDate(isoDate)}`;
}

/** ISO timestamp → "08:05 20/10/2026" in local time. */
export function formatDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "20/10/2026" (also "20-10-2026", "20.10.2026", "2/3/1990") → "2026-10-20", or null if not a real date. */
export function parseDisplayDate(text: string): string | null {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIsoDate(date);
}

/** Calendar arithmetic on "YYYY-MM-DD". */
export function addDays(isoDate: string, days: number): string {
  const d = toLocalDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Whole years between a date of birth and `onDate` (both "YYYY-MM-DD"). */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// Time-based rules (can I cancel / check in / mark no-show?) are decided by the server and
// arrive as `allowedActions`; the client deliberately has no copy of them.
