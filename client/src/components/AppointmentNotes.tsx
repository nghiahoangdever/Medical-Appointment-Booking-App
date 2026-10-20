import { useState } from 'react';
import type { FormEvent } from 'react';
import { appointmentsApi } from '../api/appointments';
import { errorMessage, fieldErrorMessages } from '../i18n/errors';
import { ROLE_LABEL } from '../i18n/labels';
import { formatDateTime } from '../lib/date';
import type { StaffAppointment } from '../types';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { TextAreaField } from './ui/FormField';

interface AppointmentNotesProps {
  appointment: StaffAppointment;
  onAdded: (updated: StaffAppointment) => void;
  /** Show the notes without the add form (admins can read but not write notes). */
  readOnly?: boolean;
}

/** UC-R7 / UC-D8: internal staff notes (never shown to patients) with an add form. */
export function AppointmentNotes({
  appointment,
  onAdded,
  readOnly = false,
}: AppointmentNotesProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { appointment: updated } = await appointmentsApi.addNote(appointment.id, content);
      setContent('');
      onAdded(updated);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = fieldErrorMessages(error).content;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Ghi chú nội bộ
      </h3>
      {appointment.notes.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">Chưa có ghi chú.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {appointment.notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-amber-50/60 px-3 py-2 ring-1 ring-amber-100">
              <p className="text-sm whitespace-pre-line text-slate-800">{note.content}</p>
              <p className="mt-1 text-xs text-slate-500">
                {note.author.fullName} ({ROLE_LABEL[note.author.role]}) ·{' '}
                {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <form onSubmit={submit} className="space-y-2" noValidate>
          {error !== null && !fieldError && <Alert>{errorMessage(error)}</Alert>}
          <TextAreaField
            label="Thêm ghi chú"
            rows={2}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            error={fieldError}
          />
          <Button type="submit" variant="secondary" loading={saving} disabled={!content.trim()}>
            Lưu ghi chú
          </Button>
        </form>
      )}
    </section>
  );
}
