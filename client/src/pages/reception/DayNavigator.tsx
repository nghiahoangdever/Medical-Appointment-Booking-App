import { Button } from '../../components/ui/Button';
import { addDays, formatDateLong, todayIso } from '../../lib/date';

interface DayNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

/** ← Thứ Ba, 20/10/2026 → [Hôm nay] */
export function DayNavigator({ date, onChange }: DayNavigatorProps) {
  const isToday = date === todayIso();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        aria-label="Ngày trước"
        onClick={() => onChange(addDays(date, -1))}
      >
        ‹
      </Button>
      <span className="min-w-48 text-center font-medium text-slate-900">
        {formatDateLong(date)}
        {isToday && <span className="ml-1 text-sm font-normal text-teal-700">(hôm nay)</span>}
      </span>
      <Button variant="secondary" aria-label="Ngày sau" onClick={() => onChange(addDays(date, 1))}>
        ›
      </Button>
      {!isToday && (
        <Button variant="secondary" onClick={() => onChange(todayIso())}>
          Hôm nay
        </Button>
      )}
    </div>
  );
}
