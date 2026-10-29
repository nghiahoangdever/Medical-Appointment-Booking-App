import { TrashIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { adminApi } from '../../../api/admin';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { SelectField, TextField } from '../../../components/ui/FormField';
import { useSubmit } from '../../../hooks/useSubmit';
import { errorMessage, fieldErrorMessages } from '../../../i18n/errors';
import { doctorName, shiftLabel } from '../../../i18n/labels';
import { formatDateLong } from '../../../lib/date';
import type { RosterEntry, RosterWeek } from '../../../types';
import type { RosterCell } from './RosterGrid';

const DEFAULT_MAX_PATIENTS = '10';

interface RosterEntryPanelProps {
  week: RosterWeek;
  cell: RosterCell;
  /** Called after a change, with a confirmation message. */
  onChanged: (message: string) => void;
  onClose: () => void;
}

/** Editor for the selected roster slot: add a doctor to an empty slot, or edit/remove an entry. */
export function RosterEntryPanel({ week, cell, onChanged, onClose }: RosterEntryPanelProps) {
  const entry = week.entries.find(
    (e) => e.date === cell.date && e.shiftId === cell.shiftId && e.roomId === cell.roomId,
  );
  const room = week.rooms.find((r) => r.id === cell.roomId);
  const shift = week.shifts.find((s) => s.id === cell.shiftId);
  const title = `${formatDateLong(cell.date)} · ${shift ? shiftLabel(shift.name) : ''} · Phòng ${room?.code ?? ''}`;

  return (
    <section
      aria-label="Chi tiết ca trực"
      className="rounded-xl bg-white p-5 ring-1 ring-slate-200"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {entry ? 'Ca trực' : 'Thêm ca trực'}
          </h2>
          <p className="text-sm text-slate-500">{title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded text-sm text-slate-500 hover:text-slate-900"
        >
          Đóng
        </button>
      </div>
      {entry ? (
        <EditEntry key={entry.id} week={week} entry={entry} onChanged={onChanged} />
      ) : (
        <AddEntry week={week} cell={cell} onChanged={onChanged} />
      )}
    </section>
  );
}

function AddEntry({
  week,
  cell,
  onChanged,
}: {
  week: RosterWeek;
  cell: RosterCell;
  onChanged: (m: string) => void;
}) {
  const [doctorId, setDoctorId] = useState('');
  const [maxPatients, setMaxPatients] = useState(DEFAULT_MAX_PATIENTS);
  const save = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);

  // Shown next to doctors who already have an entry in this date + shift (the server rejects them).
  const busyIn = new Map(
    week.entries
      .filter((e) => e.date === cell.date && e.shiftId === cell.shiftId)
      .map((e) => [e.doctor.id, week.rooms.find((r) => r.id === e.roomId)?.code ?? '']),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await save.run(() =>
      adminApi.createRosterEntry({
        ...cell,
        doctorId: Number(doctorId),
        maxPatients: Number(maxPatients),
      }),
    );
    if (result) onChanged(`Đã thêm ca trực cho ${doctorName(result.entry.doctor)}.`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-[minmax(0,2fr)_160px_auto] items-start gap-4"
      noValidate
    >
      <div className="col-span-3">
        {save.error !== null && Object.keys(fieldErrors).length === 0 && (
          <Alert>{errorMessage(save.error)}</Alert>
        )}
      </div>
      <SelectField
        label="Bác sĩ"
        value={doctorId}
        onChange={(e) => setDoctorId(e.target.value)}
        error={fieldErrors.doctorId}
        options={[
          { value: '', label: 'Chọn bác sĩ' },
          ...week.doctors.map((d) => ({
            value: String(d.id),
            label: `${d.specialty.name} — ${doctorName(d)}${busyIn.has(d.id) ? ` (đang trực phòng ${busyIn.get(d.id)})` : ''}`,
          })),
        ]}
      />
      <TextField
        label="Số bệnh nhân tối đa"
        type="number"
        min={1}
        max={100}
        value={maxPatients}
        onChange={(e) => setMaxPatients(e.target.value)}
        error={fieldErrors.maxPatients}
      />
      <div className="pt-6">
        <Button type="submit" loading={save.busy} disabled={!doctorId}>
          Thêm ca trực
        </Button>
      </div>
    </form>
  );
}

function EditEntry({
  week,
  entry,
  onChanged,
}: {
  week: RosterWeek;
  entry: RosterEntry;
  onChanged: (m: string) => void;
}) {
  const [maxPatients, setMaxPatients] = useState(String(entry.maxPatients));
  const [roomId, setRoomId] = useState(String(entry.roomId));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSubmit();
  const remove = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);

  // Rooms already used in this date + shift by another entry (the server rejects them).
  const occupied = new Set(
    week.entries
      .filter((e) => e.date === entry.date && e.shiftId === entry.shiftId && e.id !== entry.id)
      .map((e) => e.roomId),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const changes: { roomId?: number; maxPatients?: number } = {};
    if (Number(maxPatients) !== entry.maxPatients) changes.maxPatients = Number(maxPatients);
    if (Number(roomId) !== entry.roomId) changes.roomId = Number(roomId);
    const result = await save.run(() => adminApi.updateRosterEntry(entry.id, changes));
    if (result) onChanged(`Đã cập nhật ca trực của ${doctorName(entry.doctor)}.`);
  }

  async function doDelete() {
    const result = await remove.run(() => adminApi.deleteRosterEntry(entry.id));
    if (result !== undefined) onChanged(`Đã xóa ca trực của ${doctorName(entry.doctor)}.`);
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-x-6 gap-y-3 text-sm">
        <Info label="Bác sĩ">
          {doctorName(entry.doctor)}
          {!entry.doctor.isActive && <span className="ml-1 text-danger">(ngừng hoạt động)</span>}
        </Info>
        <Info label="Chuyên khoa">{entry.doctor.specialty.name}</Info>
        <Info label="Đã đặt / tối đa">
          {entry.activeCount} / {entry.maxPatients}
        </Info>
        <Info label="Tổng lượt đặt (kể cả đã hủy)">{entry.appointmentCount}</Info>
      </dl>

      {!entry.editable ? (
        <p className="text-sm text-slate-500">Ngày đã qua — lịch trực chỉ để xem.</p>
      ) : (
        <form
          onSubmit={submit}
          className="grid grid-cols-[200px_minmax(0,1fr)_auto] items-start gap-4"
          noValidate
        >
          <div className="col-span-3">
            {save.error !== null && Object.keys(fieldErrors).length === 0 && (
              <Alert>{errorMessage(save.error)}</Alert>
            )}
          </div>
          <TextField
            label="Số bệnh nhân tối đa"
            type="number"
            min={entry.minMaxPatients}
            max={100}
            value={maxPatients}
            onChange={(e) => setMaxPatients(e.target.value)}
            hint={`Tối thiểu ${entry.minMaxPatients} (số lượt đã đặt)`}
            error={fieldErrors.maxPatients}
          />
          <SelectField
            label="Phòng"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            error={fieldErrors.roomId}
            options={week.rooms
              .filter((r) => r.isActive || r.id === entry.roomId)
              .map((r) => ({
                value: String(r.id),
                label: `${r.code}${occupied.has(r.id) ? ' (đã có bác sĩ trực)' : ''}`,
              }))}
          />
          <div className="pt-6">
            <Button type="submit" loading={save.busy}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      )}

      {entry.editable && (
        <div className="border-t border-slate-100 pt-4">
          {remove.error !== null && (
            <div className="mb-3">
              <Alert>{errorMessage(remove.error)}</Alert>
            </div>
          )}
          {entry.deletable ? (
            confirmDelete ? (
              <div
                role="group"
                aria-label="Xóa ca trực này?"
                className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-tone-error-bg px-3 py-2 ring-1 ring-tone-error-ring ring-inset"
              >
                <span className="text-sm text-slate-900">Xóa ca trực này?</span>
                <Button
                  variant="danger"
                  loading={remove.busy}
                  onClick={() => void doDelete()}
                  autoFocus
                >
                  Xóa
                </Button>
                <Button
                  variant="secondary"
                  disabled={remove.busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Không
                </Button>
              </div>
            ) : (
              <Button variant="secondary" icon={TrashIcon} onClick={() => setConfirmDelete(true)}>
                Xóa ca trực
              </Button>
            )
          ) : (
            <p className="text-sm text-slate-500">
              Không thể xóa: ca trực đã có {entry.appointmentCount} lượt đặt (kể cả đã hủy). Hãy
              giảm số bệnh nhân tối đa nếu muốn ngừng nhận thêm.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
