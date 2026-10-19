import type { AppointmentStatus } from '../../domain/enums';
import type { AppointmentRecord } from './appointment.repository';

/** The appointment as the API returns it. */
export interface AppointmentView {
  id: number;
  code: string;
  queueNumber: number;
  status: AppointmentStatus;
  reason: string | null;
  date: string;
  shift: { id: number; name: string; startTime: string; endTime: string };
  specialty: { id: number; name: string };
  doctor: { id: number; fullName: string; title: string };
  room: { id: number; code: string; name: string; floor: string | null };
  bookedAt: Date;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export function toAppointmentView(a: AppointmentRecord): AppointmentView {
  const { shift, room, doctor } = a.rosterEntry;
  return {
    id: a.id,
    code: a.code,
    queueNumber: a.queueNumber,
    status: a.status as AppointmentStatus,
    reason: a.reason,
    date: a.rosterEntry.date,
    shift: { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
    specialty: { id: doctor.specialty.id, name: doctor.specialty.name },
    doctor: { id: doctor.id, fullName: doctor.user.fullName, title: doctor.title },
    room: { id: room.id, code: room.code, name: room.name, floor: room.floor },
    bookedAt: a.bookedAt,
    checkedInAt: a.checkedInAt,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    cancelledAt: a.cancelledAt,
    cancelReason: a.cancelReason,
  };
}
