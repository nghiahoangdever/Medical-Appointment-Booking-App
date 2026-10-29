import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { appointmentsApi } from '../../../api/appointments';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { TextAreaField } from '../../../components/ui/FormField';
import { errorMessage, fieldErrorMessages, hasErrorCode } from '../../../i18n/errors';
import { doctorName, shiftLabel } from '../../../i18n/labels';
import { formatDateLong } from '../../../lib/date';
import type { Appointment, Doctor, ShiftAvailability, Specialty } from '../../../types';

interface StepConfirmProps {
  specialty: Specialty;
  doctor: Doctor | null;
  date: string;
  shift: ShiftAvailability;
  onBooked: (appointment: Appointment) => void;
  /** Back to step 3 with fresh availability (the shift filled up or started meanwhile). */
  onPickAnotherShift: () => void;
}

const REASON_MAX = 500;

/** UC-P4: review the choices, add a reason, and book. */
export function StepConfirm({
  specialty,
  doctor,
  date,
  shift,
  onBooked,
  onPickAnotherShift,
}: StepConfirmProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { appointment } = await appointmentsApi.book({
        specialtyId: specialty.id,
        doctorId: doctor?.id,
        date,
        shiftId: shift.shiftId,
        reason: reason.trim() || undefined,
      });
      onBooked(appointment);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  const slotGone = hasErrorCode(error, 'SHIFT_FULL', 'SHIFT_ALREADY_STARTED', 'NO_DOCTOR_ON_DUTY');

  return (
    <section className="max-w-2xl space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">Xác nhận thông tin đặt lịch</h2>

      <dl className="rounded-xl bg-white px-4 ring-1 ring-slate-200 [&>div:last-child]:border-b-0">
        <Row label="Chuyên khoa">{specialty.name}</Row>
        <Row label="Bác sĩ">{doctor ? doctorName(doctor) : 'Hệ thống tự phân công'}</Row>
        <Row label="Ngày khám">{formatDateLong(date)}</Row>
        <Row label="Ca khám">
          {shiftLabel(shift.name)} ({shift.startTime}–{shift.endTime})
        </Row>
      </dl>

      <TextAreaField
        label="Lý do khám / triệu chứng (không bắt buộc)"
        maxLength={REASON_MAX}
        hint={`${reason.length}/${REASON_MAX} ký tự`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={fieldErrorMessages(error).reason}
      />

      {error !== null && (
        <Alert>
          <p>{errorMessage(error)}</p>
          {slotGone && (
            <button
              type="button"
              onClick={onPickAnotherShift}
              className="mt-1 font-medium underline"
            >
              Chọn ca khác
            </button>
          )}
          {hasErrorCode(error, 'DUPLICATE_BOOKING') && (
            <Link to="/patient" className="mt-1 inline-block font-medium underline">
              Xem lịch hẹn của tôi
            </Link>
          )}
        </Alert>
      )}

      <Button loading={submitting} onClick={() => void submit()}>
        Xác nhận đặt lịch
      </Button>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-slate-100 py-3">
      <dt className="w-40 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}
