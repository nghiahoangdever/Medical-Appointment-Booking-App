// Calendar dates are "YYYY-MM-DD" strings and times of day are "HH:mm" strings,
// both in the clinic's local timezone. Functions that depend on "now" take it as a
// parameter so services can inject a clock and tests can fix the time.

const pad = (n: number) => String(n).padStart(2, '0');

/** A source of the current time; services receive one so tests can control it. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(now: Date = new Date()): string {
  return toDateString(now);
}

/** "HH:mm" of `now`. */
export function timeOfDay(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeek(date: string): number {
  return (parse(date).getDay() + 6) % 7;
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, -dayOfWeek(date));
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateString(parse(value)) === value;
}

/** True once the moment `date` + `time` ("HH:mm") has been reached. */
export function hasTimePassed(date: string, time: string, now: Date): boolean {
  const current = today(now);
  return date < current || (date === current && timeOfDay(now) >= time);
}
