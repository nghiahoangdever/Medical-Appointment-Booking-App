import { useCallback, useState } from 'react';
import { adminApi } from '../../../api/admin';
import { LoadError } from '../../../components/LoadError';
import { PageHeader } from '../../../components/PageHeader';
import { RefreshButton } from '../../../components/RefreshButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { PageSpinner } from '../../../components/ui/PageSpinner';
import { useApi } from '../../../hooks/useApi';
import { useSubmit } from '../../../hooks/useSubmit';
import { errorMessage, translateError } from '../../../i18n/errors';
import { shiftLabel } from '../../../i18n/labels';
import {
  addDays,
  formatDateLong,
  formatDateRange,
  startOfWeekIso,
  todayIso,
} from '../../../lib/date';
import type { CopyWeekResult, RosterWeek } from '../../../types';
import { RosterEntryPanel } from './RosterEntryPanel';
import { RosterGrid, type RosterCell } from './RosterGrid';

/** UC-A6 / UC-A7: the weekly duty roster editor. */
export function RosterPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeekIso(todayIso()));
  const load = useCallback(() => adminApi.rosterWeek(weekStart), [weekStart]);
  const { data, error, loading, refresh } = useApi(load, { keepData: true });
  const [selected, setSelected] = useState<RosterCell | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [copyResult, setCopyResult] = useState<CopyWeekResult | null>(null);
  const copy = useSubmit();

  const thisWeek = startOfWeekIso(todayIso());
  // While the next week loads, keepData still shows the previous one: only use matching data.
  const week = data?.weekStart === weekStart ? data : null;

  function goToWeek(start: string) {
    setWeekStart(start);
    setSelected(null);
    setNotice(null);
    setCopyResult(null);
    setConfirmCopy(false);
    copy.setError(null);
  }

  function handleChanged(message: string) {
    setNotice(message);
    void refresh();
  }

  async function copyPreviousWeek() {
    const result = await copy.run(() => adminApi.copyPreviousWeek(weekStart));
    setConfirmCopy(false);
    if (!result) return;
    setCopyResult(result);
    setNotice(null);
    void refresh();
  }

  return (
    <>
      <PageHeader
        title="Lịch trực theo tuần"
        subtitle="Chọn một ô để thêm bác sĩ trực, hoặc chọn ca trực để sửa số bệnh nhân tối đa, đổi phòng hay xóa."
        actions={<RefreshButton onClick={() => void refresh()} loading={loading} />}
      />

      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label="Tuần trước"
            onClick={() => goToWeek(addDays(weekStart, -7))}
          >
            ‹
          </Button>
          <span className="min-w-56 text-center font-medium text-slate-900">
            Tuần {formatDateRange(weekStart, addDays(weekStart, 6))}
            {weekStart === thisWeek && (
              <span className="ml-1 text-sm font-normal text-teal-700">(tuần này)</span>
            )}
          </span>
          <Button
            variant="secondary"
            aria-label="Tuần sau"
            onClick={() => goToWeek(addDays(weekStart, 7))}
          >
            ›
          </Button>
          {weekStart !== thisWeek && (
            <Button variant="secondary" onClick={() => goToWeek(thisWeek)}>
              Tuần này
            </Button>
          )}
        </div>
        {confirmCopy ? (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
            <span className="text-sm text-slate-800">
              Sao chép lịch trực tuần{' '}
              {formatDateRange(addDays(weekStart, -7), addDays(weekStart, -1))} sang tuần{' '}
              {formatDateRange(weekStart, addDays(weekStart, 6))}? Ca bị trùng sẽ được bỏ qua.
            </span>
            <Button loading={copy.busy} onClick={() => void copyPreviousWeek()}>
              Sao chép
            </Button>
            <Button variant="secondary" onClick={() => setConfirmCopy(false)}>
              Hủy
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmCopy(true)}>
            Sao chép tuần trước
          </Button>
        )}
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      {copy.error !== null && (
        <div className="mb-4">
          <Alert>{errorMessage(copy.error)}</Alert>
        </div>
      )}
      {copyResult && week && <CopySummary result={copyResult} week={week} />}
      {error !== null && (
        <div className="mb-4">
          <LoadError error={error} onRetry={() => void refresh()} />
        </div>
      )}
      {week && week.entries.length === 0 && !copyResult && (
        <div className="mb-4">
          <Alert tone="info">
            Tuần này chưa có ca trực nào. Chọn một ô trống để thêm bác sĩ trực, hoặc dùng “Sao chép
            tuần trước”.
          </Alert>
        </div>
      )}

      {!week ? (
        error === null && <PageSpinner />
      ) : (
        <div className="space-y-4">
          <RosterGrid week={week} selected={selected} onSelect={setSelected} />
          {selected && (
            <RosterEntryPanel
              key={`${selected.date}-${selected.shiftId}-${selected.roomId}`}
              week={week}
              cell={selected}
              onChanged={handleChanged}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </>
  );
}

function CopySummary({ result, week }: { result: CopyWeekResult; week: RosterWeek }) {
  const shiftName = (id: number) => shiftLabel(week.shifts.find((s) => s.id === id)?.name ?? '');
  const roomCode = (id: number) => week.rooms.find((r) => r.id === id)?.code ?? `#${id}`;
  return (
    <div className="mb-4">
      <Alert tone={result.skipped.length ? 'info' : 'success'}>
        <p className="font-medium">
          Đã sao chép {result.created} ca trực từ tuần{' '}
          {formatDateRange(result.sourceWeekStart, addDays(result.sourceWeekStart, 6))}.
          {result.skipped.length > 0 && ` Bỏ qua ${result.skipped.length} ca:`}
        </p>
        {result.skipped.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {result.skipped.map((s) => (
              <li key={s.sourceEntryId}>
                {formatDateLong(s.date)} · {shiftName(s.shiftId)} · Phòng {roomCode(s.roomId)} ·{' '}
                {s.doctorName} — {translateError(s.reason)}
              </li>
            ))}
          </ul>
        )}
      </Alert>
    </div>
  );
}
