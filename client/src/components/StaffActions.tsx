import { useState } from 'react';
import { appointmentsApi } from '../api/appointments';
import { errorMessage } from '../i18n/errors';
import type { AppointmentAction, StaffAppointment } from '../types';
import { CancelAppointment } from './CancelAppointment';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

type ButtonAction = Exclude<AppointmentAction, 'CANCEL'>;

interface ActionConfig {
  label: string;
  variant: 'primary' | 'secondary';
  /** Ask before doing it (shown inline, no browser dialog). */
  confirm?: string;
  call: (id: number) => Promise<unknown>;
  done: (who: string) => string;
}

// Display order: the "forward" action first, then no-show; cancel (own component) last.
const ACTIONS: Record<ButtonAction, ActionConfig> = {
  CHECK_IN: {
    label: 'Check-in',
    variant: 'primary',
    call: appointmentsApi.checkIn,
    done: (who) => `Đã check-in cho ${who}.`,
  },
  START: {
    label: 'Bắt đầu khám',
    variant: 'primary',
    call: appointmentsApi.start,
    done: (who) => `Đang khám: ${who}.`,
  },
  COMPLETE: {
    label: 'Hoàn thành khám',
    variant: 'primary',
    call: appointmentsApi.complete,
    done: (who) => `Đã khám xong: ${who}.`,
  },
  MARK_NO_SHOW: {
    label: 'Vắng mặt',
    variant: 'secondary',
    confirm: 'Đánh dấu bệnh nhân vắng mặt?',
    call: appointmentsApi.markNoShow,
    done: (who) => `Đã đánh dấu vắng mặt: ${who}.`,
  },
};
const ORDER: ButtonAction[] = ['CHECK_IN', 'START', 'COMPLETE', 'MARK_NO_SHOW'];

interface StaffActionsProps {
  appointment: StaffAppointment;
  /** Called after a successful action with a confirmation message. */
  onDone: (message: string) => void;
}

/**
 * Buttons for the state-machine actions staff may take on an appointment. Shows exactly the
 * actions in `allowedActions` (decided by the server), so reception sees check-in / no-show /
 * cancel and doctors see start / complete / no-show without any rules in the client.
 */
export function StaffActions({ appointment: a, onDone }: StaffActionsProps) {
  const [busy, setBusy] = useState<ButtonAction | null>(null);
  const [confirming, setConfirming] = useState<ButtonAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (a.allowedActions.length === 0) return null;

  const who = `${a.patient.fullName} (STT ${a.queueNumber})`;

  async function run(action: ButtonAction) {
    setBusy(action);
    setError(null);
    try {
      await ACTIONS[action].call(a.id);
      onDone(ACTIONS[action].done(who));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-start gap-2">
        {ORDER.filter((action) => a.allowedActions.includes(action)).map((action) => {
          const config = ACTIONS[action];
          if (confirming === action) {
            return (
              <div
                key={action}
                className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-100"
              >
                <span className="text-sm text-slate-800">{config.confirm}</span>
                <Button variant="danger" loading={busy === action} onClick={() => void run(action)}>
                  Xác nhận
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(null)}>
                  Không
                </Button>
              </div>
            );
          }
          return (
            <Button
              key={action}
              variant={config.variant}
              loading={busy === action}
              disabled={busy !== null}
              onClick={() => (config.confirm ? setConfirming(action) : void run(action))}
            >
              {config.label}
            </Button>
          );
        })}
        <CancelAppointment
          appointment={a}
          onCancelled={() => onDone(`Đã hủy lịch hẹn ${a.code} của ${a.patient.fullName}.`)}
        />
      </div>
    </div>
  );
}
