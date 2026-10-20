import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { LoadError } from '../../components/LoadError';
import { PageHeader } from '../../components/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { useSubmit } from '../../hooks/useSubmit';
import { errorMessage, fieldErrorMessages } from '../../i18n/errors';
import type { AdminRoom } from '../../types';
import { ActiveBadge, EmptyRow, ListWithForm, RowAction, Td, Th } from './shared';

const EMPTY = { code: '', name: '', floor: '' };

/** UC-A2: manage rooms. */
export function RoomsPage() {
  const load = useCallback(() => adminApi.rooms().then((r) => r.rooms), []);
  const { data, error, refresh } = useApi(load, { keepData: true });
  const [editing, setEditing] = useState<AdminRoom | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit();
  const toggle = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);

  function edit(r: AdminRoom | null) {
    setEditing(r);
    setForm(r ? { code: r.code, name: r.name, floor: r.floor ?? '' } : EMPTY);
    save.setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await save.run(() =>
      editing ? adminApi.updateRoom(editing.id, form) : adminApi.createRoom(form),
    );
    if (!result) return;
    setNotice(`Đã ${editing ? 'cập nhật' : 'thêm'} phòng ${result.room.code}.`);
    edit(null);
    void refresh();
  }

  async function toggleActive(r: AdminRoom) {
    const updated = await toggle.run(() => adminApi.setRoomActive(r.id, !r.isActive));
    if (!updated) return;
    setNotice(
      `Đã ${updated.isActive ? 'kích hoạt lại' : 'ngừng hoạt động'} phòng ${updated.code}.`,
    );
    void refresh();
  }

  return (
    <>
      <PageHeader
        title="Phòng khám"
        subtitle="Phòng ngừng hoạt động không thể xếp lịch trực và các ca trực trong phòng sẽ không nhận đặt lịch mới."
      />
      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      {toggle.error !== null && (
        <div className="mb-4">
          <Alert>{errorMessage(toggle.error)}</Alert>
        </div>
      )}
      {error !== null && !data && <LoadError error={error} onRetry={() => void refresh()} />}
      {!data ? (
        !error && <PageSpinner />
      ) : (
        <ListWithForm
          list={
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Mã phòng</Th>
                  <Th>Tên phòng</Th>
                  <Th>Tầng</Th>
                  <Th>Trạng thái</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 && (
                  <EmptyRow
                    colSpan={5}
                    message="Chưa có phòng khám nào. Thêm phòng ở biểu mẫu bên phải."
                  />
                )}
                {data.map((r) => (
                  <tr key={r.id} className={editing?.id === r.id ? 'bg-teal-50/50' : undefined}>
                    <Td className="font-mono font-medium">{r.code}</Td>
                    <Td>{r.name}</Td>
                    <Td>{r.floor || '—'}</Td>
                    <Td>
                      <ActiveBadge isActive={r.isActive} />
                    </Td>
                    <Td className="space-x-3 text-right whitespace-nowrap">
                      <RowAction onClick={() => edit(r)}>Sửa</RowAction>
                      <RowAction
                        tone={r.isActive ? 'danger' : 'default'}
                        disabled={toggle.busy}
                        onClick={() => void toggleActive(r)}
                      >
                        {r.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                      </RowAction>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          form={
            <form onSubmit={submit} className="space-y-4" noValidate>
              <h2 className="font-semibold text-slate-900">
                {editing ? `Sửa: ${editing.code}` : 'Thêm phòng khám'}
              </h2>
              {save.error !== null && Object.keys(fieldErrors).length === 0 && (
                <Alert>{errorMessage(save.error)}</Alert>
              )}
              <TextField
                label="Mã phòng"
                placeholder="VD: B2-05"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                error={fieldErrors.code}
              />
              <TextField
                label="Tên phòng"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={fieldErrors.name}
              />
              <TextField
                label="Tầng (không bắt buộc)"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                error={fieldErrors.floor}
              />
              <div className="flex gap-2">
                <Button type="submit" loading={save.busy}>
                  {editing ? 'Lưu thay đổi' : 'Thêm'}
                </Button>
                {editing && (
                  <Button variant="secondary" onClick={() => edit(null)}>
                    Hủy sửa
                  </Button>
                )}
              </div>
            </form>
          }
        />
      )}
    </>
  );
}
