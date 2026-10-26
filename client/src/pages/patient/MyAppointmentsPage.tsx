import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { appointmentsApi } from '../../api/appointments';
import { AppointmentCard } from '../../components/AppointmentCard';
import { CancelAppointment } from '../../components/CancelAppointment';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { RefreshButton } from '../../components/RefreshButton';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { LoadError } from '../../components/LoadError';
import { useApi } from '../../hooks/useApi';
import { todayIso } from '../../lib/date';
import type { Appointment, AppointmentStatus } from '../../types';

const ACTIVE_STATUSES: AppointmentStatus[] = ['BOOKED', 'CHECKED_IN', 'IN_EXAMINATION'];

/** Upcoming = still active and not on a past date; everything else is history. */
function isUpcoming(a: Appointment, today: string) {
  return ACTIVE_STATUSES.includes(a.status) && a.date >= today;
}

type Tab = 'upcoming' | 'past';

/** UC-P5 / UC-P6 / UC-P7: the patient's appointments, with details and cancel. */
export function MyAppointmentsPage() {
  const load = useCallback(() => appointmentsApi.mine().then((r) => r.appointments), []);
  const { data, setData, error, loading, refresh } = useApi(load);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [notice, setNotice] = useState<string | null>(null);
  const bookedId = (useLocation().state as { bookedId?: number } | null)?.bookedId;

  const today = todayIso();
  const upcoming = (data ?? []).filter((a) => isUpcoming(a, today));
  // The API returns soonest first; history reads better most recent first.
  const past = (data ?? []).filter((a) => !isUpcoming(a, today)).reverse();
  const shown = tab === 'upcoming' ? upcoming : past;

  function handleCancelled(updated: Appointment) {
    setData((list) => list?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
    setNotice(`Đã hủy lịch hẹn ${updated.code}.`);
  }

  return (
    <>
      <PageHeader
        title="Lịch hẹn của tôi"
        actions={
          <>
            <RefreshButton onClick={() => void refresh()} loading={loading} />
            <Link to="/patient/book">
              <Button>Đặt lịch khám</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        <TabButton active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
          Sắp tới ({upcoming.length})
        </TabButton>
        <TabButton active={tab === 'past'} onClick={() => setTab('past')}>
          Đã qua ({past.length})
        </TabButton>
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      {error && !data ? (
        <LoadError error={error} onRetry={() => void refresh()} />
      ) : !data ? (
        <PageSpinner />
      ) : shown.length === 0 ? (
        <EmptyState
          message={
            tab === 'upcoming' ? 'Bạn chưa có lịch hẹn sắp tới.' : 'Chưa có lịch hẹn nào trước đây.'
          }
          action={
            tab === 'upcoming' && (
              <Link to="/patient/book">
                <Button>Đặt lịch khám</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              defaultExpanded={a.id === bookedId}
              actions={<PatientActions appointment={a} onCancelled={handleCancelled} />}
            />
          ))}
        </div>
      )}
    </>
  );
}

function PatientActions({
  appointment,
  onCancelled,
}: {
  appointment: Appointment;
  onCancelled: (updated: Appointment) => void;
}) {
  // BOOKED but the server no longer allows CANCEL → the shift has started.
  if (appointment.status === 'BOOKED' && !appointment.allowedActions.includes('CANCEL')) {
    return (
      <p className="text-sm text-slate-500">
        Ca khám đã bắt đầu nên không thể hủy trực tuyến. Vui lòng liên hệ quầy lễ tân.
      </p>
    );
  }
  return <CancelAppointment appointment={appointment} onCancelled={onCancelled} />;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
