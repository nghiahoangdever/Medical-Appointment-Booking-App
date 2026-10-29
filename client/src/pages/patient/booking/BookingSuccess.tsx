import { CheckIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router';
import { QueueNumber } from '../../../components/QueueNumber';
import { Button } from '../../../components/ui/Button';
import { doctorName, shiftLabel } from '../../../i18n/labels';
import { formatDateLong } from '../../../lib/date';
import type { Appointment } from '../../../types';

/** Shown after booking: the appointment code and queue number the patient needs at reception. */
export function BookingSuccess({
  appointment: a,
  onBookAnother,
}: {
  appointment: Appointment;
  onBookAnother: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-tone-success-bg text-tone-success-fg">
        <CheckIcon aria-hidden="true" className="size-6" />
      </div>
      <h2 role="status" className="text-xl font-semibold text-slate-900">
        Đặt lịch thành công!
      </h2>

      <div className="my-5 flex flex-wrap items-center justify-center gap-5">
        <QueueNumber value={a.queueNumber} size="lg" label="Số thứ tự" />
        <div className="text-left">
          <p className="text-xs text-slate-500">Mã lịch hẹn</p>
          <p className="code-text mt-1 text-xl text-slate-900">{a.code}</p>
          <p className="mt-3 text-xs text-slate-500">Đọc mã này tại quầy lễ tân</p>
        </div>
      </div>

      <dl className="space-y-1 text-sm text-slate-700">
        <div>
          <dt className="inline text-slate-500">Bác sĩ: </dt>
          <dd className="inline">{doctorName(a.doctor)}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Thời gian: </dt>
          <dd className="inline">
            {shiftLabel(a.shift.name)} ({a.shift.startTime}–{a.shift.endTime}),{' '}
            {formatDateLong(a.date)}
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Phòng: </dt>
          <dd className="inline">
            {a.room.name}
            {a.room.floor && `, tầng ${a.room.floor}`}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-slate-500">
        Vui lòng đến quầy lễ tân trước giờ bắt đầu ca khám và đọc mã lịch hẹn để check-in.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/patient" state={{ bookedId: a.id }}>
          <Button>Xem lịch hẹn của tôi</Button>
        </Link>
        <Button variant="secondary" onClick={onBookAnother}>
          Đặt thêm lịch khác
        </Button>
      </div>
    </section>
  );
}
