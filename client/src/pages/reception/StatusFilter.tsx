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
      <Chip active={selected === null} onClick={() => onSelect(null)}>
        Tất cả{total !== null && ` (${total})`}
      </Chip>
      {ORDER.map((status) => (
        <Chip key={status} active={selected === status} onClick={() => onSelect(status)}>
          {STATUS_LABEL[status]}
          {counts && ` (${counts[status]})`}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
        active
          ? 'bg-teal-600 text-white ring-teal-600'
          : 'bg-white text-slate-700 ring-slate-300 hover:ring-teal-400'
      }`}
    >
      {children}
    </button>
  );
}
