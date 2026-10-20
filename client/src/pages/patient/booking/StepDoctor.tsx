import { useCallback } from 'react';
import { specialtiesApi } from '../../../api/booking';
import { EmptyState } from '../../../components/EmptyState';
import { LoadError } from '../../../components/LoadError';
import { PageSpinner } from '../../../components/ui/PageSpinner';
import { useApi } from '../../../hooks/useApi';
import { doctorName } from '../../../i18n/labels';
import type { Doctor, Specialty } from '../../../types';
import { ChoiceCard } from './ChoiceCard';

interface StepDoctorProps {
  specialty: Specialty;
  /** undefined = not chosen yet, null = any doctor. */
  selected: Doctor | null | undefined;
  onSelect: (doctor: Doctor | null) => void;
}

/** Choosing a doctor is optional: "any doctor" lets the system assign one. */
export function StepDoctor({ specialty, selected, onSelect }: StepDoctorProps) {
  const load = useCallback(
    () => specialtiesApi.doctors(specialty.id).then((r) => r.doctors),
    [specialty.id],
  );
  const { data, error, refresh } = useApi(load);

  if (error) return <LoadError error={error} onRetry={() => void refresh()} />;
  if (!data) return <PageSpinner />;

  if (data.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Chọn bác sĩ</h2>
        <EmptyState
          message={`Chuyên khoa ${specialty.name} hiện chưa có bác sĩ nhận lịch. Vui lòng chọn chuyên khoa khác.`}
        />
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Chọn bác sĩ</h2>
      <p className="mb-3 text-sm text-slate-500">
        Không bắt buộc — bạn có thể để hệ thống tự phân công bác sĩ.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <ChoiceCard selected={selected === null} onClick={() => onSelect(null)}>
          <p className="font-medium text-slate-900">Bất kỳ bác sĩ nào</p>
          <p className="mt-1 text-sm text-slate-500">
            Hệ thống chọn bác sĩ đang trực còn ít lượt đặt nhất.
          </p>
        </ChoiceCard>
        {data.map((d) => (
          <ChoiceCard key={d.id} selected={selected?.id === d.id} onClick={() => onSelect(d)}>
            <p className="font-medium text-slate-900">{doctorName(d)}</p>
            {d.bio && <p className="mt-1 text-sm text-slate-500">{d.bio}</p>}
          </ChoiceCard>
        ))}
      </div>
    </section>
  );
}
