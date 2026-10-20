import { useState } from 'react';
import { appointmentsApi } from '../../api/appointments';
import { CancelAppointment } from '../../components/CancelAppointment';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../i18n/errors';
import type { StaffAppointment } from '../../types';

interface ReceptionActionsProps {
  appointment: StaffAppointment;
  /** Called after a successful action with a confirmation message. */
  onDone: (message: string) => void;
}

/**
 * UC-R3 check-in, UC-R5 no-show, UC-R4 cancel. Only actions listed in `allowedActions`
 * (computed by the server from the state machine and the shift times) are shown.
 */
export function ReceptionActions({ appointment: a, onDone }: ReceptionActionsProps) {
  const [busy, setBusy] = useState<'CHECK_IN' | 'MARK_NO_SHOW' | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const can = (action: StaffAppointment['allowedActions'][number]) =>
    a.allowedActions.includes(action);

  if (a.allowedActions.length === 0) return null;

  async function run(
    action: 'CHECK_IN' | 'MARK_NO_SHOW',
    call: () => Promise<unknown>,
    message: string,
  ) {
    setBusy(action);
    setError(null);
    try {
      await call();
      onDone(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setConfirmNoShow(false);
    }
  }

  const who = `${a.patient.fullName} (STT ${a.queueNumber})`;

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-start gap-2">
        {can('CHECK_IN') && (
          <Button
            loading={busy === 'CHECK_IN'}
            disabled={busy !== null}
            onClick={() =>
              void run('CHECK_IN', () => appointmentsApi.checkIn(a.id), `Đã check-in cho ${who}.`)
            }
          >
            Check-in
          </Button>
        )}
        {can('MARK_NO_SHOW') &&
          (confirmNoShow ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
              <span className="text-sm text-slate-800">Đánh dấu bệnh nhân vắng mặt?</span>
              <Button
                variant="danger"
                loading={busy === 'MARK_NO_SHOW'}
                onClick={() =>
                  void run(
                    'MARK_NO_SHOW',
                    () => appointmentsApi.markNoShow(a.id),
                    `Đã đánh dấu vắng mặt: ${who}.`,
                  )
                }
              >
                Xác nhận
              </Button>
              <Button variant="secondary" onClick={() => setConfirmNoShow(false)}>
                Không
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => setConfirmNoShow(true)}
            >
              Vắng mặt
            </Button>
          ))}
        <CancelAppointment
          appointment={a}
          onCancelled={() => onDone(`Đã hủy lịch hẹn ${a.code} của ${a.patient.fullName}.`)}
        />
      </div>
    </div>
  );
}
