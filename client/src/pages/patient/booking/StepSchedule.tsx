import { useCallback } from 'react';
import { availabilityApi } from '../../../api/booking';
import { RefreshButton } from '../../../components/RefreshButton';
import { Alert } from '../../../components/ui/Alert';
import { PageSpinner } from '../../../components/ui/PageSpinner';
import { useApi } from '../../../hooks/useApi';
import { errorMessage } from '../../../i18n/errors';
import { shiftLabel } from '../../../i18n/labels';
import { formatDateLong, formatDayMonth, weekdayShort } from '../../../lib/date';
import type { DayAvailability, Doctor, ShiftAvailability, Specialty } from '../../../types';
import { ChoiceCard } from './ChoiceCard';

interface StepScheduleProps {
  specialty: Specialty;
  doctor: Doctor | null;
  selectedDate: string | null;
  selectedShiftId?: number;
  /** Change it to force a reload (e.g. after the chosen shift turned out to be full). */
  reloadKey: number;
  onSelectDate: (date: string) => void;
  onSelectShift: (date: string, shift: ShiftAvailability) => void;
}

const hasOpenShift = (day: DayAvailability) => day.shifts.some((s) => s.status === 'AVAILABLE');

/** UC-P3: pick a day of the booking window, then a shift with places left. */
export function StepSchedule({
  specialty,
  doctor,
  selectedDate,
  selectedShiftId,
  reloadKey,
  onSelectDate,
  onSelectShift,
}: StepScheduleProps) {
  const doctorId = doctor?.id;
  const load = useCallback(
    () => availabilityApi.get(specialty.id, doctorId),
    // reloadKey is a deliberate trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specialty.id, doctorId, reloadKey],
  );
  const { data, error, loading, refresh } = useApi(load);

  if (error && !data) return <Alert>{errorMessage(error)}</Alert>;
  if (!data) return <PageSpinner />;

  // Default to the first day that still has room.
  const activeDate = selectedDate ?? data.days.find(hasOpenShift)?.date ?? null;
  const activeDay = data.days.find((d) => d.date === activeDate);

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Chọn ngày khám</h2>
          <RefreshButton onClick={() => void refresh()} loading={loading} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {data.days.map((day) => (
            <DayButton
              key={day.date}
              day={day}
              selected={day.date === activeDate}
              onClick={() => onSelectDate(day.date)}
            />
          ))}
        </div>
      </div>

      {activeDay && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Chọn ca khám{' '}
            <span className="font-normal text-slate-500">— {formatDateLong(activeDay.date)}</span>
          </h2>
          {activeDay.shifts.length === 0 ? (
            <p className="text-sm text-slate-500">Không có bác sĩ trực trong ngày này.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeDay.shifts.map((shift) => (
                <ShiftButton
                  key={shift.shiftId}
                  shift={shift}
                  showDoctorCount={doctor === null}
                  selected={activeDay.date === selectedDate && shift.shiftId === selectedShiftId}
                  onClick={() => onSelectShift(activeDay.date, shift)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DayButton({
  day,
  selected,
  onClick,
}: {
  day: DayAvailability;
  selected: boolean;
  onClick: () => void;
}) {
  const open = hasOpenShift(day);
  const note = day.shifts.length === 0 ? 'Không có lịch' : open ? 'Còn chỗ' : 'Hết chỗ';
  return (
    <ChoiceCard
      selected={selected}
      disabled={day.shifts.length === 0}
      onClick={onClick}
      className="p-2! text-center"
    >
      <span className="block text-xs text-slate-500">{weekdayShort(day.date)}</span>
      <span className="block font-semibold text-slate-900">{formatDayMonth(day.date)}</span>
      <span className={`mt-1 block text-[11px] ${open ? 'text-emerald-700' : 'text-slate-400'}`}>
        {note}
      </span>
    </ChoiceCard>
  );
}

function shiftNote(shift: ShiftAvailability): string {
  switch (shift.status) {
    case 'AVAILABLE':
      return `Còn ${shift.remainingSlots} chỗ`;
    case 'FULL':
      return 'Hết chỗ';
    case 'STARTED':
      return 'Đã bắt đầu';
  }
}

function ShiftButton({
  shift,
  showDoctorCount,
  selected,
  onClick,
}: {
  shift: ShiftAvailability;
  showDoctorCount: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const available = shift.status === 'AVAILABLE';
  return (
    <ChoiceCard selected={selected} disabled={!available} onClick={onClick}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-slate-900">{shiftLabel(shift.name)}</p>
        <p className="text-sm text-slate-600">
          {shift.startTime}–{shift.endTime}
        </p>
      </div>
      <p className={`mt-1 text-sm ${available ? 'text-emerald-700' : 'text-slate-500'}`}>
        {shiftNote(shift)}
        {showDoctorCount && ` · ${shift.doctorsOnDuty} bác sĩ trực`}
      </p>
    </ChoiceCard>
  );
}
