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
import type { StaffAccount } from '../../types';
import { ActiveBadge, EmptyRow, ListWithForm, RowAction, Td, Th } from './shared';

const EMPTY = { fullName: '', email: '', phone: '', password: '' };

/** UC-A4: manage receptionist accounts. */
export function ReceptionistsPage() {
  const load = useCallback(() => adminApi.receptionists().then((r) => r.receptionists), []);
  const { data, error, refresh } = useApi(load, { keepData: true });
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit();
  const toggle = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);
  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function edit(u: StaffAccount | null) {
    setEditing(u);
    setForm(u ? { fullName: u.fullName, email: u.email, phone: u.phone, password: '' } : EMPTY);
    save.setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { password, ...rest } = form;
    const result = await save.run(() =>
      editing
        ? adminApi.updateReceptionist(editing.id, { ...rest, ...(password ? { password } : {}) })
        : adminApi.createReceptionist(form),
    );
    if (!result) return;
    setNotice(
      `Đã ${editing ? 'cập nhật' : 'thêm'} tài khoản lễ tân ${result.receptionist.fullName}.`,
    );
    edit(null);
    void refresh();
  }

  async function toggleActive(u: StaffAccount) {
    const updated = await toggle.run(() => adminApi.setReceptionistActive(u.id, !u.isActive));
    if (!updated) return;
    setNotice(
      `Đã ${updated.isActive ? 'kích hoạt lại' : 'ngừng hoạt động'} tài khoản ${updated.fullName}.`,
    );
    void refresh();
  }

  return (
    <>
      <PageHeader title="Lễ tân" subtitle="Tài khoản ngừng hoạt động không thể đăng nhập." />
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
                  <Th>Họ và tên</Th>
                  <Th>Email</Th>
                  <Th>Số điện thoại</Th>
                  <Th>Trạng thái</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 && (
                  <EmptyRow
                    colSpan={5}
                    message="Chưa có tài khoản lễ tân nào. Thêm tài khoản ở biểu mẫu bên phải."
                  />
                )}
                {data.map((u) => (
                  <tr key={u.id} className={editing?.id === u.id ? 'bg-brand-50/50' : undefined}>
                    <Td className="font-medium">{u.fullName}</Td>
                    <Td>{u.email}</Td>
                    <Td>{u.phone}</Td>
                    <Td>
                      <ActiveBadge isActive={u.isActive} />
                    </Td>
                    <Td className="space-x-3 text-right whitespace-nowrap">
                      <RowAction onClick={() => edit(u)}>Sửa</RowAction>
                      <RowAction
                        tone={u.isActive ? 'danger' : 'default'}
                        disabled={toggle.busy}
                        onClick={() => void toggleActive(u)}
                      >
                        {u.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
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
                {editing ? `Sửa: ${editing.fullName}` : 'Thêm tài khoản lễ tân'}
              </h2>
              {save.error !== null && Object.keys(fieldErrors).length === 0 && (
                <Alert>{errorMessage(save.error)}</Alert>
              )}
              <TextField
                label="Họ và tên"
                value={form.fullName}
                onChange={(e) => set('fullName')(e.target.value)}
                error={fieldErrors.fullName}
              />
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                error={fieldErrors.email}
              />
              <TextField
                label="Số điện thoại"
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value)}
                error={fieldErrors.phone}
              />
              <TextField
                label={editing ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set('password')(e.target.value)}
                error={fieldErrors.password}
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
