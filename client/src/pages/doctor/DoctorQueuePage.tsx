import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { doctorApi } from '../../api/doctor';
import { AppointmentCard } from '../../components/AppointmentCard';
import { AppointmentNotes } from '../../components/AppointmentNotes';
import { LoadError } from '../../components/LoadError';
import { PageHeader } from '../../components/PageHeader';
import { PatientInfo } from '../../components/PatientInfo';
import { RefreshButton } from '../../components/RefreshButton';
import { StaffActions } from '../../components/StaffActions';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { errorMessage } from '../../i18n/errors';
import { shiftLabel } from '../../i18n/labels';
import { formatDateLong } from '../../lib/date';
import type { AppointmentStatus, StaffAppointment } from '../../types';

const POLL_MS = 15_000;
const DONE: AppointmentStatus[] = ['COMPLETED', 'NO_SHOW', 'CANCELLED'];

/**
 * UC-D2..D8: one shift's queue. Left: the patient in examination (details, notes, complete)
 * and "call next". Right: waiting (checked in), not yet arrived, and finished appointments.
 * Every button comes from the server's allowedActions / nextAppointmentId.
 */
export function DoctorQueuePage() {
  const rosterEntryId = Number(useParams().rosterEntryId);
  const load = useCallback(() => doctorApi.queue(rosterEntryId), [rosterEntryId]);
  const { data, error, loading, refresh } = useApi(load, { pollMs: POLL_MS, keepData: true });
  const [notice, setNotice] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  function handleDone(message: string) {
    setNotice(message);
    setCallError(null);
    void refresh();
  }

  async function callNext() {
    setCalling(true);
    setCallError(null);
    try {
      const { appointment } = await doctorApi.callNext(rosterEntryId);
      handleDone(`Đang khám: ${appointment.patient.fullName} (STT ${appointment.queueNumber}).`);
    } catch (err) {
      setCallError(errorMessage(err));
      void refresh();
    } finally {
      setCalling(false);
    }
  }

  if (error !== null && !data) {
    return (
      <>
        <BackLink />
        <LoadError error={error} onRetry={() => void refresh()} />
      </>
    );
  }
  if (!data) return <PageSpinner />;

  const { entry, appointments, nextAppointmentId, inExaminationElsewhere: elsewhere } = data;
  const byStatus = (...statuses: AppointmentStatus[]) =>
    appointments.filter((a) => statuses.includes(a.status));
  const current = byStatus('IN_EXAMINATION')[0];
  const waiting = byStatus('CHECKED_IN');
  const notArrived = byStatus('BOOKED');
  const finished = byStatus(...DONE);
  const next = appointments.find((a) => a.id === nextAppointmentId);

  const card = (a: StaffAppointment, defaultExpanded = false) => (
    <AppointmentCard
      key={a.id}
      appointment={a}
      title={a.patient.fullName}
      subtitle={a.reason || 'Không ghi lý do khám'}
      defaultExpanded={defaultExpanded}
      actions={<StaffActions appointment={a} onDone={handleDone} />}
    >
      <PatientInfo patient={a.patient} />
      <AppointmentNotes appointment={a} onAdded={() => void refresh()} />
    </AppointmentCard>
  );

  return (
    <>
      <BackLink />
      <PageHeader
        title={`Hàng đợi — ${shiftLabel(entry.shift.name)} (${entry.shift.startTime}–${entry.shift.endTime})`}
        subtitle={`${formatDateLong(entry.date)} · ${entry.room.name} · ${entry.specialty.name}. Tự động làm mới mỗi 15 giây.`}
        actions={<RefreshButton onClick={() => void refresh()} loading={loading} />}
      />

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      {error !== null && (
        <div className="mb-4">
          <LoadError error={error} onRetry={() => void refresh()} />
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-6">
        {/* Left: call next + current patient */}
        <div className="space-y-4">
          <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <Button
              className="w-full py-3 text-base"
              disabled={nextAppointmentId === null}
              loading={calling}
              onClick={() => void callNext()}
            >
              Gọi bệnh nhân tiếp theo
            </Button>
            <p className="mt-2 text-center text-sm text-slate-500">
              {next
                ? `Tiếp theo: STT ${next.queueNumber} — ${next.patient.fullName}`
                : current
                  ? 'Hoàn thành bệnh nhân đang khám để gọi người tiếp theo.'
                  : elsewhere
                    ? null
                    : 'Chưa có bệnh nhân nào đang chờ (đã check-in).'}
            </p>
            {elsewhere && (
              <div className="mt-3">
                <Alert tone="info">
                  Bạn đang khám STT {elsewhere.queueNumber} — {elsewhere.patientName} (
                  {shiftLabel(elsewhere.shift.name)}). Mỗi bác sĩ chỉ khám một bệnh nhân tại một
                  thời điểm; hãy hoàn thành lượt khám đó trước.{' '}
                  <Link
                    to={`/doctor/queue/${elsewhere.rosterEntryId}`}
                    className="font-medium underline"
                  >
                    Mở hàng đợi {shiftLabel(elsewhere.shift.name).toLowerCase()}
                  </Link>
                </Alert>
              </div>
            )}
            {callError && (
              <div className="mt-3">
                <Alert>{callError}</Alert>
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Đang khám</SectionTitle>
            {current ? (
              <div className="rounded-xl ring-2 ring-violet-300">{card(current, true)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                Chưa có bệnh nhân đang khám.
              </p>
            )}
          </section>
        </div>

        {/* Right: the rest of the queue */}
        <div className="space-y-6">
          <QueueSection
            title="Đang chờ (đã check-in)"
            items={waiting}
            render={card}
            empty="Không có bệnh nhân đang chờ."
          />
          <QueueSection
            title="Chưa đến"
            items={notArrived}
            render={card}
            empty="Tất cả bệnh nhân đã đến."
          />
          <QueueSection
            title="Đã xong"
            items={finished}
            render={card}
            empty="Chưa có lượt khám nào kết thúc."
          />
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link to="/doctor" className="mb-3 inline-block text-sm text-brand-700 hover:underline">
      ← Lịch trực
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold text-slate-600">{children}</h2>;
}

function QueueSection({
  title,
  items,
  render,
  empty,
}: {
  title: string;
  items: StaffAppointment[];
  render: (a: StaffAppointment) => ReactNode;
  empty: string;
}) {
  return (
    <section>
      <SectionTitle>
        {title} <span className="font-normal text-slate-400">({items.length})</span>
      </SectionTitle>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">{items.map((a) => render(a))}</div>
      )}
    </section>
  );
}
