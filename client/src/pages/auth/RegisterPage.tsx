import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_HOME } from '../../auth/roles';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/FormField';
import { errorMessage, fieldErrorMessages, translateError } from '../../i18n/errors';
import { GENDER_LABEL } from '../../i18n/labels';
import { parseDisplayDate } from '../../lib/date';
import type { Gender } from '../../types';
import { AuthCard } from './AuthCard';

const GENDER_OPTIONS = (['FEMALE', 'MALE', 'OTHER'] as Gender[]).map((value) => ({
  value,
  label: GENDER_LABEL[value],
}));

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  /** Typed as dd/mm/yyyy; converted to YYYY-MM-DD before sending. */
  dateOfBirth: '',
  gender: 'FEMALE' as Gender,
  address: '',
};

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const clientErrors: Record<string, string> = {};
    const dateOfBirth = parseDisplayDate(form.dateOfBirth);
    if (!dateOfBirth) clientErrors.dateOfBirth = translateError('DATE_INVALID');
    if (form.password !== form.confirmPassword) {
      clientErrors.confirmPassword = translateError('PASSWORD_MISMATCH');
    }
    setFieldErrors(clientErrors);
    if (!dateOfBirth || Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      const created = await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        dateOfBirth,
        gender: form.gender,
        address: form.address.trim() || undefined,
      });
      navigate(ROLE_HOME[created.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setFieldErrors(fieldErrorMessages(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Tạo tài khoản bệnh nhân"
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-teal-700 hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Họ và tên"
          autoComplete="name"
          value={form.fullName}
          onChange={(e) => set('fullName')(e.target.value)}
          error={fieldErrors.fullName}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            error={fieldErrors.email}
          />
          <TextField
            label="Số điện thoại"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value)}
            error={fieldErrors.phone}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Ngày sinh"
            placeholder="dd/mm/yyyy"
            inputMode="numeric"
            autoComplete="bday"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth')(e.target.value)}
            error={fieldErrors.dateOfBirth}
          />
          <SelectField
            label="Giới tính"
            options={GENDER_OPTIONS}
            value={form.gender}
            onChange={(e) => set('gender')(e.target.value)}
            error={fieldErrors.gender}
          />
        </div>
        <TextField
          label="Địa chỉ (không bắt buộc)"
          autoComplete="street-address"
          value={form.address}
          onChange={(e) => set('address')(e.target.value)}
          error={fieldErrors.address}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete="new-password"
            hint="Ít nhất 8 ký tự"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            error={fieldErrors.password}
          />
          <TextField
            label="Nhập lại mật khẩu"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword')(e.target.value)}
            error={fieldErrors.confirmPassword}
          />
        </div>
        <Button type="submit" loading={submitting} className="w-full">
          Tạo tài khoản
        </Button>
      </form>
    </AuthCard>
  );
}
