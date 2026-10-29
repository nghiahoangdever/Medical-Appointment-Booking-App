import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { Button } from '../../components/ui/Button';
import { addDays, formatDateLong, todayIso } from '../../lib/date';

interface DayNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

/** ‹ Thứ Ba, 20/10/2026 › [Hôm nay] */
export function DayNavigator({ date, onChange }: DayNavigatorProps) {
  const isToday = date === todayIso();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        square
        icon={ChevronLeftIcon}
        aria-label="Ngày trước"
        onClick={() => onChange(addDays(date, -1))}
      />
      <span
        aria-live="polite"
        className="min-w-[min(260px,calc(100vw-168px))] text-center text-base font-medium text-slate-900"
      >
        {formatDateLong(date)}
        {isToday && <span className="ml-1 text-sm font-normal text-brand-700">(hôm nay)</span>}
      </span>
      <Button
        variant="secondary"
        square
        icon={ChevronRightIcon}
        aria-label="Ngày sau"
        onClick={() => onChange(addDays(date, 1))}
      />
      {!isToday && (
        <Button variant="ghost" onClick={() => onChange(todayIso())}>
          Hôm nay
        </Button>
      )}
    </div>
  );
}
