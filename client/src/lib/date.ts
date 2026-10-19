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

/** True once `isoDate` at `time` ("HH:mm") has been reached, e.g. a shift has started. */
export function hasTimePassed(isoDate: string, time: string, now: Date = new Date()): boolean {
  const today = todayIso(now);
  const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return isoDate < today || (isoDate === today && current >= time);
}
