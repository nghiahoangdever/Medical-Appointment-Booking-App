import { Link } from 'react-router';
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
    <section className="mx-auto max-w-lg rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-6" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-900">Đặt lịch thành công!</h2>

      <div className="my-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Mã lịch hẹn</p>
          <p className="mt-1 font-mono text-xl font-semibold tracking-wider text-slate-900">
            {a.code}
          </p>
        </div>
        <div className="rounded-xl bg-teal-50 p-3">
          <p className="text-xs text-teal-700">Số thứ tự</p>
          <p className="mt-1 text-xl font-semibold text-teal-800">{a.queueNumber}</p>
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

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link to="/patient" state={{ bookedId: a.id }}>
          <Button className="w-full">Xem lịch hẹn của tôi</Button>
        </Link>
        <Button variant="secondary" onClick={onBookAnother}>
          Đặt thêm lịch khác
        </Button>
      </div>
    </section>
  );
}
