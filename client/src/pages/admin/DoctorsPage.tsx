import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../../api/admin';
import { LoadError } from '../../components/LoadError';
import { PageHeader } from '../../components/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormField';
import { PageSpinner } from '../../components/ui/PageSpinner';
import { useApi } from '../../hooks/useApi';
import { useSubmit } from '../../hooks/useSubmit';
import { errorMessage, fieldErrorMessages } from '../../i18n/errors';
import { doctorName } from '../../i18n/labels';
import type { AdminDoctor } from '../../types';
import { ActiveBadge, EmptyRow, ListWithForm, RowAction, Td, Th } from './shared';

const EMPTY = {
  fullName: '',
  title: '',
  specialtyId: '',
  email: '',
  phone: '',
  password: '',
  bio: '',
};

/** UC-A3: manage doctor accounts. The specialty is chosen at creation and can't change. */
export function DoctorsPage() {
  const load = useCallback(() => Promise.all([adminApi.doctors(), adminApi.specialties()]), []);
  const { data, error, refresh } = useApi(load, { keepData: true });
  const [editing, setEditing] = useState<AdminDoctor | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit();
  const toggle = useSubmit();
  const fieldErrors = fieldErrorMessages(save.error);
  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function edit(d: AdminDoctor | null) {
    setEditing(d);
    setForm(
      d
        ? {
            fullName: d.fullName,
            title: d.title,
            specialtyId: String(d.specialty.id),
            email: d.email,
            phone: d.phone,
            password: '',
            bio: d.bio ?? '',
          }
        : EMPTY,
    );
    save.setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { specialtyId, password, ...rest } = form;
    const result = await save.run(() =>
      editing
        ? adminApi.updateDoctor(editing.id, { ...rest, ...(password ? { password } : {}) })
        : adminApi.createDoctor({ ...rest, password, specialtyId: Number(specialtyId) }),
    );
    if (!result) return;
    setNotice(`Đã ${editing ? 'cập nhật' : 'thêm'} bác sĩ ${doctorName(result.doctor)}.`);
    edit(null);
    void refresh();
  }

  async function toggleActive(d: AdminDoctor) {
    const updated = await toggle.run(() => adminApi.setDoctorActive(d.id, !d.isActive));
    if (!updated) return;
    setNotice(
      `Đã ${updated.isActive ? 'kích hoạt lại' : 'ngừng hoạt động'} tài khoản ${doctorName(updated)}.`,
    );
    void refresh();
  }

  if (error !== null && !data) return <LoadError error={error} onRetry={() => void refresh()} />;
  if (!data) return <PageSpinner />;
  const [{ doctors }, { specialties }] = data;

  return (
    <>
      <PageHeader
        title="Bác sĩ"
        subtitle="Bác sĩ ngừng hoạt động không thể đăng nhập, không được xếp lịch trực và không nhận đặt lịch mới."
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
      <ListWithForm
        list={
          <table className="w-full">
            <thead>
              <tr>
                <Th>Bác sĩ</Th>
                <Th>Chuyên khoa</Th>
                <Th>Liên hệ</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.length === 0 && (
                <EmptyRow
                  colSpan={5}
                  message="Chưa có bác sĩ nào. Thêm bác sĩ ở biểu mẫu bên phải."
                />
              )}
              {doctors.map((d) => (
                <tr key={d.id} className={editing?.id === d.id ? 'bg-teal-50/50' : undefined}>
                  <Td className="font-medium">{doctorName(d)}</Td>
                  <Td>{d.specialty.name}</Td>
                  <Td>
                    <div>{d.email}</div>
                    <div className="text-slate-500">{d.phone}</div>
                  </Td>
                  <Td>
                    <ActiveBadge isActive={d.isActive} />
                  </Td>
                  <Td className="space-x-3 text-right whitespace-nowrap">
                    <RowAction onClick={() => edit(d)}>Sửa</RowAction>
                    <RowAction
                      tone={d.isActive ? 'danger' : 'default'}
                      disabled={toggle.busy}
                      onClick={() => void toggleActive(d)}
                    >
                      {d.isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
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
              {editing ? `Sửa: ${doctorName(editing)}` : 'Thêm bác sĩ'}
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
              label="Học hàm / học vị"
              placeholder="VD: BS.CKI, ThS.BS"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
              error={fieldErrors.title}
            />
            {editing ? (
              <div className="text-sm">
                <p className="font-medium text-slate-700">Chuyên khoa</p>
                <p className="mt-1 text-slate-900">{editing.specialty.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Không đổi được sau khi tạo (lịch hẹn cũ thuộc chuyên khoa này).
                </p>
              </div>
            ) : (
              <SelectField
                label="Chuyên khoa"
                value={form.specialtyId}
                onChange={(e) => set('specialtyId')(e.target.value)}
                error={fieldErrors.specialtyId}
                options={[
                  { value: '', label: 'Chọn chuyên khoa' },
                  ...specialties
                    .filter((s) => s.isActive)
                    .map((s) => ({ value: String(s.id), label: s.name })),
                ]}
              />
            )}
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
            <TextAreaField
              label="Giới thiệu (không bắt buộc)"
              value={form.bio}
              maxLength={500}
              onChange={(e) => set('bio')(e.target.value)}
              error={fieldErrors.bio}
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
    </>
  );
}
