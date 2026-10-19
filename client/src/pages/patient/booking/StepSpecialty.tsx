import { useCallback } from 'react';
import { specialtiesApi } from '../../../api/booking';
import { Alert } from '../../../components/ui/Alert';
import { PageSpinner } from '../../../components/ui/PageSpinner';
import { useApi } from '../../../hooks/useApi';
import { errorMessage } from '../../../i18n/errors';
import type { Specialty } from '../../../types';
import { ChoiceCard } from './ChoiceCard';

interface StepSpecialtyProps {
  selectedId?: number;
  onSelect: (specialty: Specialty) => void;
}

export function StepSpecialty({ selectedId, onSelect }: StepSpecialtyProps) {
  const load = useCallback(() => specialtiesApi.list().then((r) => r.specialties), []);
  const { data, error } = useApi(load);

  if (error) return <Alert>{errorMessage(error)}</Alert>;
  if (!data) return <PageSpinner />;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Chọn chuyên khoa</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((s) => (
          <ChoiceCard key={s.id} selected={s.id === selectedId} onClick={() => onSelect(s)}>
            <p className="font-medium text-slate-900">{s.name}</p>
            {s.description && <p className="mt-1 text-sm text-slate-500">{s.description}</p>}
          </ChoiceCard>
        ))}
      </div>
    </section>
  );
}
