import { STATUS_LABEL } from '../i18n/labels';
import type { AppointmentStatus } from '../types';

const STYLES: Record<AppointmentStatus, string> = {
  BOOKED: 'bg-sky-50 text-sky-700 ring-sky-200',
  CHECKED_IN: 'bg-amber-50 text-amber-800 ring-amber-200',
  IN_EXAMINATION: 'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  NO_SHOW: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
