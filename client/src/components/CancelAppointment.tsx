import { useState } from 'react';
import { appointmentsApi } from '../api/appointments';
import { errorMessage } from '../i18n/errors';
import type { Appointment } from '../types';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { TextAreaField } from './ui/FormField';

interface CancelAppointmentProps<T extends Appointment> {
  appointment: T;
  onCancelled: (updated: T) => void;
}

/**
 * UC-P7 / UC-R4: "Hủy lịch hẹn" with an inline confirmation and optional reason.
 * Rendered only when the server lists CANCEL in `allowedActions`.
 */
export function CancelAppointment<T extends Appointment>({
  appointment,
  onCancelled,
}: CancelAppointmentProps<T>) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!appointment.allowedActions.includes('CANCEL')) return null;

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
      const { appointment: updated } = await appointmentsApi.cancel<T>(
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
    <div className="w-full space-y-3 rounded-lg bg-red-50/50 p-3 ring-1 ring-red-100">
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
