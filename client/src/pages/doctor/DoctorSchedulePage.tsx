import { useCallback } from 'react';
import { Link } from 'react-router';
import { doctorApi } from '../../api/doctor';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { LoadError } from '../../components/LoadError';
import { RefreshButton } from '../../components/RefreshButton';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { shiftLabel } from '../../i18n/labels';
import { formatDateLong, todayIso } from '../../lib/date';
import type { AppointmentStatus } from '../../types';

/** Status columns shown for each shift, in queue order. */
const COLUMNS: { status: AppointmentStatus; label: string }[] = [
  { status: 'BOOKED', label: 'Chưa đến' },
  { status: 'CHECKED_IN', label: 'Đang chờ' },
  { status: 'IN_EXAMINATION', label: 'Đang khám' },
  { status: 'COMPLETED', label: 'Đã khám' },
  { status: 'NO_SHOW', label: 'Vắng mặt' },
];

/** UC-D1: the doctor's duty shifts from today on; open one to see its queue. */
export function DoctorSchedulePage() {
  const load = useCallback(() => doctorApi.schedule().then((r) => r.shifts), []);
  const { data, error, loading, refresh } = useApi(load, { pollMs: 30_000, keepData: true });
  const today = todayIso();

  return (
    <>
      <PageHeader
        title="Lịch trực của tôi"
        subtitle="Các ca trực từ hôm nay trong 14 ngày tới. Chọn một ca để mở hàng đợi."
        actions={<RefreshButton onClick={() => void refresh()} loading={loading} />}
      />

      {error !== null && !data ? (
        <LoadError error={error} onRetry={() => void refresh()} />
      ) : !data ? (
        <PageSpinner />
      ) : data.length === 0 ? (
        <EmptyState message="Bạn chưa có ca trực nào trong 14 ngày tới." />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Ngày</th>
                <th className="px-4 py-3 font-semibold">Ca</th>
                <th className="px-4 py-3 font-semibold">Phòng</th>
                {COLUMNS.map((c) => (
                  <th key={c.status} className="px-4 py-3 text-right font-semibold">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold">Tối đa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((s) => (
                <tr key={s.id} className={s.date === today ? 'bg-teal-50/40' : undefined}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatDateLong(s.date)}
                    {s.date === today && (
                      <span className="ml-2 rounded-full bg-teal-600 px-2 py-0.5 text-xs font-medium text-white">
                        Hôm nay
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {shiftLabel(s.shift.name)} ({s.shift.startTime}–{s.shift.endTime})
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.room.code}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.status} className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {s.counts[c.status] || <span className="text-slate-300">0</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {s.maxPatients}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/doctor/queue/${s.id}`}
                      className="font-medium whitespace-nowrap text-teal-700 hover:underline"
                    >
                      Mở hàng đợi →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
