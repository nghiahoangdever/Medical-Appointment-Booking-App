import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { doctorName, shiftLabel } from '../i18n/labels';
import { formatDate, formatDateTime, formatDayMonth, weekdayShort } from '../lib/date';
import type { Appointment } from '../types';
import { StatusBadge } from './StatusBadge';

interface AppointmentCardProps {
  appointment: Appointment;
  defaultExpanded?: boolean;
  /** Extra details shown when expanded (e.g. patient info and notes for staff). */
  children?: ReactNode;
  /** Buttons/forms for the actions this viewer may take, shown when expanded. */
  actions?: ReactNode;
}

/** An appointment as a collapsible card: summary row, click to see details and actions. */
export function AppointmentCard({
  appointment: a,
  defaultExpanded = false,
  children,
  actions,
}: AppointmentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <article className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="w-14 shrink-0 rounded-lg bg-teal-50 py-1.5 text-center text-teal-800">
          <div className="text-xs font-medium">{weekdayShort(a.date)}</div>
          <div className="text-sm font-semibold">{formatDayMonth(a.date)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{a.specialty.name}</p>
          <p className="truncate text-sm text-slate-500">
            {doctorName(a.doctor)} · {shiftLabel(a.shift.name)} {a.shift.startTime}–
            {a.shift.endTime}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm text-slate-500">
            STT <span className="font-semibold text-slate-900">{a.queueNumber}</span>
          </span>
          <StatusBadge status={a.status} />
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`size-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-slate-100 px-4 py-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Mã lịch hẹn">
              <span className="font-mono font-semibold tracking-wide">{a.code}</span>
            </Detail>
            <Detail label="Số thứ tự">{a.queueNumber}</Detail>
            <Detail label="Ngày khám">{formatDate(a.date)}</Detail>
            <Detail label="Ca khám">
              {shiftLabel(a.shift.name)} ({a.shift.startTime}–{a.shift.endTime})
            </Detail>
            <Detail label="Bác sĩ">{doctorName(a.doctor)}</Detail>
            <Detail label="Phòng">
              {a.room.name}
              {a.room.floor && ` · Tầng ${a.room.floor}`}
            </Detail>
            <Detail label="Lý do khám">{a.reason || '—'}</Detail>
            <Detail label="Đặt lúc">{formatDateTime(a.bookedAt)}</Detail>
            {a.checkedInAt && <Detail label="Check-in lúc">{formatDateTime(a.checkedInAt)}</Detail>}
            {a.startedAt && <Detail label="Bắt đầu khám">{formatDateTime(a.startedAt)}</Detail>}
            {a.completedAt && (
              <Detail label="Hoàn thành lúc">{formatDateTime(a.completedAt)}</Detail>
            )}
            {a.cancelledAt && <Detail label="Hủy lúc">{formatDateTime(a.cancelledAt)}</Detail>}
            {a.cancelledAt && <Detail label="Lý do hủy">{a.cancelReason || '—'}</Detail>}
          </dl>
          {children}
          {actions}
        </div>
      )}
    </article>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
