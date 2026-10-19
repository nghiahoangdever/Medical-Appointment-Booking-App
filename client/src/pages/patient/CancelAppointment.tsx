import { useState } from 'react';
import { appointmentsApi } from '../../api/booking';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextAreaField } from '../../components/ui/FormField';
import { errorMessage } from '../../i18n/errors';
import { hasTimePassed } from '../../lib/date';
import type { Appointment } from '../../types';

interface CancelAppointmentProps {
  appointment: Appointment;
  onCancelled: (updated: Appointment) => void;
}

/** UC-P7: cancel button with an inline confirmation (patients: BOOKED and before the shift starts). */
export function CancelAppointment({ appointment, onCancelled }: CancelAppointmentProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (appointment.status !== 'BOOKED') return null;

  if (hasTimePassed(appointment.date, appointment.shift.startTime)) {
    return (
      <p className="text-sm text-slate-500">
        Ca khám đã bắt đầu nên không thể hủy trực tuyến. Vui lòng liên hệ quầy lễ tân.
      </p>
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Hủy lịch hẹn
      </Button>
    );
  }

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const { appointment: updated } = await appointmentsApi.cancel(
        appointment.id,
        reason.trim() || undefined,
      );
      onCancelled(updated);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-red-50/50 p-3 ring-1 ring-red-100">
      <p className="text-sm font-medium text-slate-800">Bạn chắc chắn muốn hủy lịch hẹn này?</p>
      {error && <Alert>{error}</Alert>}
      <TextAreaField
        label="Lý do hủy (không bắt buộc)"
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" loading={submitting} onClick={() => void confirm()}>
          Xác nhận hủy
        </Button>
        <Button variant="secondary" disabled={submitting} onClick={() => setConfirming(false)}>
          Không hủy
        </Button>
      </div>
    </div>
  );
}
