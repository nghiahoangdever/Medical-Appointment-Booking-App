import { STATUS_LABEL } from '../../i18n/labels';
import type { AppointmentStatus, StatusCounts } from '../../types';

const ORDER: AppointmentStatus[] = [
  'BOOKED',
  'CHECKED_IN',
  'IN_EXAMINATION',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
];

interface StatusFilterProps {
  counts: StatusCounts | null;
  selected: AppointmentStatus | null;
  onSelect: (status: AppointmentStatus | null) => void;
}

/** Status chips with counts; also the status filter. */
export function StatusFilter({ counts, selected, onSelect }: StatusFilterProps) {
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
      <Chip active={selected === null} count={total} onClick={() => onSelect(null)}>
        Tất cả
      </Chip>
      {ORDER.map((status) => (
        <Chip
          key={status}
          active={selected === status}
          count={counts ? counts[status] : null}
          onClick={() => onSelect(status)}
        >
          {STATUS_LABEL[status]}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset transition-[box-shadow,background-color] duration-150 ${
        active
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white text-slate-700 ring-slate-300 hover:ring-brand-400'
      }`}
    >
      {children}
      {count !== null && <span className="tabular opacity-75">({count})</span>}
    </button>
  );
}
