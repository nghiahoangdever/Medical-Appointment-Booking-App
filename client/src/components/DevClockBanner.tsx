import { ClockIcon } from '@heroicons/react/20/solid';
import { useEffect, useState } from 'react';
import { http } from '../api/http';
import { formatDateTime } from '../lib/date';

/**
 * Development only: warns when the server runs with DEV_FAKE_NOW, showing its simulated time,
 * so nobody is surprised that check-in / no-show buttons follow a different clock.
 */
export function DevClockBanner() {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    http
      .get<{ now: string; fakeClock: boolean }>('/health')
      .then(({ now, fakeClock }) => {
        if (fakeClock) setOffsetMs(new Date(now).getTime() - Date.now());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (offsetMs === null) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, [offsetMs]);

  if (offsetMs === null) return null;
  const serverNow = new Date(Date.now() + offsetMs).toISOString();
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-1.5 border-b border-tone-warning-ring bg-tone-warning-bg px-4 py-1.5 text-xs text-tone-warning-fg"
    >
      <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
      Chế độ thử nghiệm: máy chủ đang dùng giờ giả lập (DEV_FAKE_NOW) — hiện là{' '}
      <strong>{formatDateTime(serverNow)}</strong>
    </div>
  );
}
