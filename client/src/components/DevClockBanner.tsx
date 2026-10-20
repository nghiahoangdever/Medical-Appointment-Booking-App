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
    <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
      Chế độ thử nghiệm: máy chủ đang dùng giờ giả lập (DEV_FAKE_NOW) — hiện là{' '}
      <strong>{formatDateTime(serverNow)}</strong>
    </div>
  );
}
