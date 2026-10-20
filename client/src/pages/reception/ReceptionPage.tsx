import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { appointmentsApi } from '../../api/appointments';
import { shiftsApi, specialtiesApi } from '../../api/booking';
import { AppointmentCard } from '../../components/AppointmentCard';
import { AppointmentNotes } from '../../components/AppointmentNotes';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { PatientInfo } from '../../components/PatientInfo';
import { RefreshButton } from '../../components/RefreshButton';
import { StaffActions } from '../../components/StaffActions';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/FormField';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { LoadError } from '../../components/LoadError';
import { doctorName, shiftLabel } from '../../i18n/labels';
import { formatDateLong, todayIso } from '../../lib/date';
import type { AppointmentStatus, StaffAppointment, StaffAppointmentFilters } from '../../types';
import { DayNavigator } from './DayNavigator';
import { StatusFilter } from './StatusFilter';

const POLL_MS = 30_000;
const ALL = { value: '', label: 'Tất cả' };

/**
 * UC-R1..R7: the receptionist's day list. Filter by day, shift, specialty, doctor and status,
 * or search by code/phone across all dates; expand a card to see the patient, add notes,
 * check in, mark no-show or cancel. Refreshes every 30 s and on demand.
 */
interface ReceptionPageProps {
  title?: string;
  subtitle?: string;
  /** Admins (UC-A8) read notes but cannot add them. */
  canAddNotes?: boolean;
}

export function ReceptionPage({
  title = 'Lịch hẹn',
  subtitle = 'Check-in, hủy lịch và theo dõi bệnh nhân. Tự động làm mới mỗi 30 giây.',
  canAddNotes = true,
}: ReceptionPageProps = {}) {
  const [date, setDate] = useState(todayIso);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Reference data for the filters
  const shifts = useApi(useCallback(() => shiftsApi.list().then((r) => r.shifts), []));
  const specialties = useApi(
    useCallback(() => specialtiesApi.list().then((r) => r.specialties), []),
  );
  const loadDoctors = useCallback(
    () => specialtiesApi.doctors(Number(specialtyId)).then((r) => r.doctors),
    [specialtyId],
  );
  const doctors = useApi(specialtyId ? loadDoctors : null);

  const filters = useMemo<StaffAppointmentFilters>(
    () => ({
      ...(query ? { q: query } : { date }),
      shiftId: shiftId ? Number(shiftId) : undefined,
      specialtyId: specialtyId ? Number(specialtyId) : undefined,
      doctorId: doctorId ? Number(doctorId) : undefined,
      status: status ?? undefined,
    }),
    [query, date, shiftId, specialtyId, doctorId, status],
  );
  const load = useCallback(() => appointmentsApi.listForStaff(filters), [filters]);
  const { data, error, loading, refresh } = useApi(load, { pollMs: POLL_MS, keepData: true });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setQuery(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setQuery('');
  }

  function handleDone(message: string) {
    setNotice(message);
    void refresh();
  }

  const groups = groupByShift(data?.appointments ?? [], query !== '');

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<RefreshButton onClick={() => void refresh()} loading={loading} />}
      />

      <div className="mb-4 space-y-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {query ? (
            <p className="text-sm text-slate-700">
              Kết quả tìm kiếm cho <strong>“{query}”</strong> trên mọi ngày
            </p>
          ) : (
            <DayNavigator date={date} onChange={setDate} />
          )}
          <form
            onSubmit={handleSearch}
            className="flex w-full items-end gap-2 sm:w-auto"
            role="search"
          >
            <TextField
              label="Tìm theo mã lịch hẹn hoặc số điện thoại"
              placeholder="VD: AP-7K3QXM hoặc 0912…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={50}
              className="sm:w-72"
            />
            <Button type="submit" disabled={!searchInput.trim()}>
              Tìm
            </Button>
            {query && (
              <Button variant="secondary" onClick={clearSearch}>
                Xóa
              </Button>
            )}
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Ca khám"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            options={[
              ALL,
              ...(shifts.data ?? []).map((s) => ({
                value: String(s.id),
                label: `${shiftLabel(s.name)} (${s.startTime}–${s.endTime})`,
              })),
            ]}
          />
          <SelectField
            label="Chuyên khoa"
            value={specialtyId}
            onChange={(e) => {
              setSpecialtyId(e.target.value);
              setDoctorId('');
            }}
            options={[
              ALL,
              ...(specialties.data ?? []).map((s) => ({ value: String(s.id), label: s.name })),
            ]}
          />
          <SelectField
            label="Bác sĩ"
            value={doctorId}
            disabled={!specialtyId}
            onChange={(e) => setDoctorId(e.target.value)}
            options={[
              specialtyId ? ALL : { value: '', label: 'Chọn chuyên khoa trước' },
              ...(doctors.data ?? []).map((d) => ({ value: String(d.id), label: doctorName(d) })),
            ]}
          />
        </div>

        <StatusFilter counts={data?.counts ?? null} selected={status} onSelect={setStatus} />
      </div>

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

      {!data ? (
        !error && <PageSpinner />
      ) : groups.length === 0 ? (
        <EmptyState
          message={
            query
              ? 'Không tìm thấy lịch hẹn phù hợp.'
              : 'Không có lịch hẹn nào khớp với bộ lọc trong ngày này.'
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 text-sm font-semibold text-slate-600">{group.title}</h2>
              <div className="space-y-2">
                {group.appointments.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    title={a.patient.fullName}
                    subtitle={`${a.specialty.name} · ${doctorName(a.doctor)} · Phòng ${a.room.code}`}
                    actions={<StaffActions appointment={a} onDone={handleDone} />}
                  >
                    <PatientInfo patient={a.patient} />
                    <AppointmentNotes
                      appointment={a}
                      onAdded={() => void refresh()}
                      readOnly={!canAddNotes}
                    />
                  </AppointmentCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** Consecutive appointments of the same date + shift (the list is already sorted that way). */
function groupByShift(appointments: StaffAppointment[], showDate: boolean) {
  const groups: { key: string; title: string; appointments: StaffAppointment[] }[] = [];
  for (const a of appointments) {
    const key = `${a.date}|${a.shift.id}`;
    let group = groups.at(-1);
    if (group?.key !== key) {
      const shift = `${shiftLabel(a.shift.name)} (${a.shift.startTime}–${a.shift.endTime})`;
      group = {
        key,
        title: showDate ? `${formatDateLong(a.date)} · ${shift}` : shift,
        appointments: [],
      };
      groups.push(group);
    }
    group.appointments.push(a);
  }
  return groups;
}
