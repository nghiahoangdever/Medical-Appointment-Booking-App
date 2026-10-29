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

const TH =
  'border-b border-slate-200 bg-slate-25 px-4 py-3 text-left text-xs font-semibold tracking-[0.05em] whitespace-nowrap text-slate-500 uppercase';
const TD = 'border-t border-slate-100 px-4 py-3 text-slate-900';

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
            <caption className="sr-only">Lịch trực của tôi</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  Ngày
                </th>
                <th scope="col" className={TH}>
                  Ca
                </th>
                <th scope="col" className={TH}>
                  Phòng
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.status} scope="col" className={`${TH} text-right`}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className={`${TH} text-right`}>
                  Tối đa
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Mở hàng đợi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className={s.date === today ? 'bg-brand-50' : undefined}>
                  <td className={`${TD} font-medium whitespace-nowrap`}>
                    {formatDateLong(s.date)}
                    {s.date === today && (
                      <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                        Hôm nay
                      </span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-slate-700`}>
                    {shiftLabel(s.shift.name)} ({s.shift.startTime}–{s.shift.endTime})
                  </td>
                  <td className={`${TD} code-text text-[13px]`}>{s.room.code}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.status} className={`${TD} tabular text-right`}>
                      {s.counts[c.status] || <span className="text-slate-500">0</span>}
                    </td>
                  ))}
                  <td className={`${TD} tabular text-right text-slate-500`}>{s.maxPatients}</td>
                  <td className={`${TD} text-right`}>
                    <Link to={`/doctor/queue/${s.id}`} className="font-medium whitespace-nowrap">
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
