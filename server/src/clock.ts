import { config } from './config';
import { systemClock, today, type Clock } from './domain/time';

/**
 * The clock the running server's services use.
 *
 * Normally the system clock. For manual testing of time-based rules, development can set
 * DEV_FAKE_NOW="HH:mm" in server/.env: the server then behaves as if it were that time today
 * (and time keeps running from there). config.ts refuses this in production, and tests never
 * load server/.env — they inject their own fixed clocks.
 */
function shiftedClock(fakeTime: string): Clock {
  const [hours, minutes] = fakeTime.split(':').map(Number);
  const start = new Date();
  const fake = new Date(start);
  fake.setHours(hours, minutes, 0, 0);
  const offsetMs = fake.getTime() - start.getTime();
  return () => new Date(Date.now() + offsetMs);
}

export const isFakeClock = config.DEV_FAKE_NOW !== undefined;

export const appClock: Clock = config.DEV_FAKE_NOW
  ? shiftedClock(config.DEV_FAKE_NOW)
  : systemClock;

if (isFakeClock) {
  const now = appClock();
  console.warn(
    `[dev] DEV_FAKE_NOW=${config.DEV_FAKE_NOW}: server clock is ${today(now)} ` +
      `${now.toTimeString().slice(0, 5)}. Remove it from server/.env to use the real time.`,
  );
}
