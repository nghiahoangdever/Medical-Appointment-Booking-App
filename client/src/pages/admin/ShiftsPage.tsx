import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { shiftsApi } from '../../api/booking';
import { PageHeader } from '../../components/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { useSubmit } from '../../hooks/useSubmit';
import { errorMessage, fieldErrorMessages } from '../../i18n/errors';
import { shiftLabel } from '../../i18n/labels';
import type { Shift } from '../../types';

/** UC-A5: the clinic's fixed shifts; only their times can change. */
export function ShiftsPage() {
  const load = useCallback(() => shiftsApi.list().then((r) => r.shifts), []);
  const { data, error, refresh } = useApi(load, { keepData: true });

  return (
    <>
      <PageHeader
        title="Ca khám"
        subtitle="Các ca khám cố định của phòng khám. Chỉ có thể đổi giờ bắt đầu và kết thúc."
      />
      <div className="mb-4">
        <Alert tone="info">
          Giờ mới áp dụng ngay cho mọi lịch trực và lịch hẹn của ca, kể cả lịch đã đặt. Các ca không
          được chồng giờ lên nhau.
        </Alert>
      </div>
      {error !== null && !data && <Alert>{errorMessage(error)}</Alert>}
      {!data ? (
        !error && <PageSpinner />
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {data.map((shift) => (
            <ShiftCard
              key={`${shift.id}-${shift.startTime}-${shift.endTime}`}
              shift={shift}
              onSaved={() => void refresh()}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ShiftCard({ shift, onSaved }: { shift: Shift; onSaved: () => void }) {
  const [times, setTimes] = useState({ startTime: shift.startTime, endTime: shift.endTime });
  const [saved, setSaved] = useState(false);
  const save = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const result = await save.run(() => adminApi.updateShiftTimes(shift.id, times));
    if (result) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-slate-200"
      noValidate
    >
      <h2 className="font-semibold text-slate-900">{shiftLabel(shift.name)}</h2>
      {saved && <Alert tone="success">Đã lưu giờ {shiftLabel(shift.name).toLowerCase()}.</Alert>}
      {save.error !== null && Object.keys(fieldErrors).length === 0 && (
        <Alert>{errorMessage(save.error)}</Alert>
      )}
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Bắt đầu"
          placeholder="HH:mm"
          value={times.startTime}
          onChange={(e) => setTimes({ ...times, startTime: e.target.value })}
          error={fieldErrors.startTime}
        />
        <TextField
          label="Kết thúc"
          placeholder="HH:mm"
          value={times.endTime}
          onChange={(e) => setTimes({ ...times, endTime: e.target.value })}
          error={fieldErrors.endTime}
        />
      </div>
      <Button type="submit" loading={save.busy}>
        Lưu
      </Button>
    </form>
  );
}
