import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { LoadError } from '../../components/LoadError';
import { PageHeader } from '../../components/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextAreaField, TextField } from '../../components/ui/FormField';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { useSubmit } from '../../hooks/useSubmit';
import { errorMessage, fieldErrorMessages } from '../../i18n/errors';
import type { AdminSpecialty } from '../../types';
import {
  ActiveBadge,
  Caption,
  EmptyRow,
  ListWithForm,
  RowAction,
  SELECTED_ROW,
  Td,
  Th,
} from './shared';

const EMPTY = { name: '', description: '' };

/** UC-A1: manage specialties. */
export function SpecialtiesPage() {
  const load = useCallback(() => adminApi.specialties().then((r) => r.specialties), []);
  const { data, error, refresh } = useApi(load, { keepData: true });
  const [editing, setEditing] = useState<AdminSpecialty | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit();
  const toggle = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);

  function edit(s: AdminSpecialty | null) {
    setEditing(s);
    setForm(s ? { name: s.name, description: s.description ?? '' } : EMPTY);
    save.setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await save.run(() =>
      editing ? adminApi.updateSpecialty(editing.id, form) : adminApi.createSpecialty(form),
    );
    if (!result) return;
    setNotice(`Đã ${editing ? 'cập nhật' : 'thêm'} chuyên khoa "${result.specialty.name}".`);
    edit(null);
    void refresh();
  }

  async function toggleActive(s: AdminSpecialty) {
    const updated = await toggle.run(() => adminApi.setSpecialtyActive(s.id, !s.isActive));
    if (!updated) return;
    setNotice(
      `Đã ${updated.isActive ? 'kích hoạt lại' : 'ngừng hoạt động'} chuyên khoa "${updated.name}".`,
    );
    void refresh();
  }

  return (
    <>
      <PageHeader
        title="Chuyên khoa"
        subtitle="Chuyên khoa ngừng hoạt động sẽ không còn hiện khi bệnh nhân đặt lịch."
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
              <Caption>Danh sách chuyên khoa</Caption>
              <thead>
                <tr>
                  <Th>Tên chuyên khoa</Th>
                  <Th>Mô tả</Th>
                  <Th className="text-right">Bác sĩ</Th>
                  <Th>Trạng thái</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <EmptyRow
                    colSpan={5}
                    message="Chưa có chuyên khoa nào. Thêm chuyên khoa ở biểu mẫu bên phải."
                  />
                )}
                {data.map((s) => (
                  <tr key={s.id} className={editing?.id === s.id ? SELECTED_ROW : undefined}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="max-w-80 text-slate-700">{s.description || '—'}</Td>
                    <Td className="tabular text-right">{s.activeDoctorCount}</Td>
                    <Td>
                      <ActiveBadge isActive={s.isActive} />
                    </Td>
                    <Td className="text-right whitespace-nowrap [&>button+button]:ml-3">
                      <RowAction onClick={() => edit(s)}>Sửa</RowAction>
                      <RowAction
                        tone={s.isActive ? 'danger' : 'default'}
                        disabled={toggle.busy}
                        onClick={() => void toggleActive(s)}
                      >
                        {s.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                      </RowAction>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          form={
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? `Sửa: ${editing.name}` : 'Thêm chuyên khoa'}
              </h2>
              {save.error !== null && Object.keys(fieldErrors).length === 0 && (
                <Alert>{errorMessage(save.error)}</Alert>
              )}
              <TextField
                label="Tên chuyên khoa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={fieldErrors.name}
              />
              <TextAreaField
                label="Mô tả (không bắt buộc)"
                value={form.description}
                maxLength={500}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                error={fieldErrors.description}
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
