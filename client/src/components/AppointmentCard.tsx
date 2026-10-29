import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { doctorName, shiftLabel } from '../i18n/labels';
import { formatDate, formatDateTime, formatDayMonth, weekdayShort } from '../lib/date';
import type { Appointment, AppointmentStatus } from '../types';
import { QueueNumber } from './QueueNumber';
import { StatusBadge } from './StatusBadge';

/** Statuses whose queue ticket is shown muted (the visit is over). */
const FINISHED: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

interface AppointmentCardProps {
  appointment: Appointment;
  /** Summary line overrides; default: specialty / doctor · shift (the patient's perspective). */
  title?: ReactNode;
  subtitle?: ReactNode;
  defaultExpanded?: boolean;
  /** Show the date tile in the summary (off for staff day/shift views where the date is fixed). */
  showDate?: boolean;
  /** "current" = the patient in examination: a stronger ring. */
  emphasis?: 'current';
  /** Extra details shown when expanded (e.g. patient info and notes for staff). */
  children?: ReactNode;
  /** Buttons/forms for the actions this viewer may take, shown when expanded. */
  actions?: ReactNode;
}

/** An appointment as a collapsible card: summary row, click to see details and actions. */
export function AppointmentCard({
  appointment: a,
  title,
  subtitle,
  defaultExpanded = false,
  showDate = true,
  emphasis,
  children,
  actions,
}: AppointmentCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <article
      className={`overflow-hidden rounded-xl bg-white ${
        emphasis === 'current' ? 'ring-2 ring-st-inexam-ring' : 'ring-1 ring-slate-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`grid w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-25 focus-visible:-outline-offset-2 ${
          showDate
            ? 'grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]'
            : 'grid-cols-[auto_minmax(0,1fr)_auto_auto]'
        }`}
      >
        {showDate && (
          <span className="w-14 rounded-lg bg-brand-50 py-1.5 text-center text-brand-800">
            <span className="block text-xs font-medium">{weekdayShort(a.date)}</span>
            <span className="tabular block text-sm font-semibold">{formatDayMonth(a.date)}</span>
          </span>
        )}
        <QueueNumber value={a.queueNumber} size="sm" muted={FINISHED.includes(a.status)} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-900">
            {title ?? a.specialty.name}
          </span>
          <span className="block truncate text-sm text-slate-500">
            {subtitle ?? (
              <>
                {doctorName(a.doctor)} · {shiftLabel(a.shift.name)} {a.shift.startTime}–
                {a.shift.endTime}
              </>
            )}
          </span>
        </span>
        <StatusBadge status={a.status} />
        <ChevronDownIcon
          aria-hidden="true"
          className={`size-5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={panelId} className="flex flex-col gap-4 border-t border-slate-100 p-4">
          <dl className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-x-6 gap-y-3 text-sm">
            <Detail label="Mã lịch hẹn">
              <span className="code-text">{a.code}</span>
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
      <dd className="mt-0.5 break-words text-slate-900">{children}</dd>
    </div>
  );
}
