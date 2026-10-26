import type { ReactNode } from 'react';
import { GENDER_LABEL } from '../i18n/labels';
import { ageOn, formatDate, todayIso } from '../lib/date';
import type { PatientDetails } from '../types';

/** UC-R6 / UC-D7: patient details inside a staff appointment card. */
export function PatientInfo({ patient }: { patient: PatientDetails }) {
  return (
    <section className="rounded-lg bg-slate-50 p-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Thông tin bệnh nhân
      </h3>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Họ và tên">{patient.fullName}</Item>
        <Item label="Số điện thoại">
          <a href={`tel:${patient.phone}`} className="text-brand-700 hover:underline">
            {patient.phone}
          </a>
        </Item>
        <Item label="Email">{patient.email}</Item>
        <Item label="Ngày sinh">
          {patient.dateOfBirth
            ? `${formatDate(patient.dateOfBirth)} (${ageOn(patient.dateOfBirth, todayIso())} tuổi)`
            : '—'}
        </Item>
        <Item label="Giới tính">{patient.gender ? GENDER_LABEL[patient.gender] : '—'}</Item>
        <Item label="Địa chỉ">{patient.address || '—'}</Item>
      </dl>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-900">{children}</dd>
    </div>
  );
}
