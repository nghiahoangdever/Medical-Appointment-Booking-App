import type { AppointmentAction } from '../../domain/appointmentStateMachine';
import { allowedActions, type Actor, type AppointmentFacts } from '../../domain/appointmentRules';
import { Role, type AppointmentStatus, type Gender } from '../../domain/enums';
import type { AppointmentRecord } from './appointment.repository';

/** The appointment as the API returns it to its patient. */
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
  /** What the viewer may do with it right now (state machine + guards); drives the UI buttons. */
  allowedActions: AppointmentAction[];
}

/** Staff additionally see the patient and the internal notes. */
export interface StaffAppointmentView extends AppointmentView {
  patient: {
    id: number;
    fullName: string;
    phone: string;
    email: string;
    dateOfBirth: string | null;
    gender: Gender | null;
    address: string | null;
  };
  notes: {
    id: number;
    content: string;
    createdAt: Date;
    author: { fullName: string; role: Role };
  }[];
}

export function appointmentFacts(a: AppointmentRecord): AppointmentFacts {
  return {
    status: a.status as AppointmentStatus,
    patientId: a.patientId,
    doctorUserId: a.rosterEntry.doctor.userId,
    date: a.rosterEntry.date,
    shiftStart: a.rosterEntry.shift.startTime,
    shiftEnd: a.rosterEntry.shift.endTime,
    doctorInExamination: a.doctorInExamination,
  };
}

export function toAppointmentView(a: AppointmentRecord, viewer: Actor, now: Date): AppointmentView {
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
    allowedActions: allowedActions(appointmentFacts(a), viewer, now),
  };
}

export function toStaffAppointmentView(
  a: AppointmentRecord,
  viewer: Actor,
  now: Date,
): StaffAppointmentView {
  const profile = a.patient.patientProfile;
  return {
    ...toAppointmentView(a, viewer, now),
    patient: {
      id: a.patient.id,
      fullName: a.patient.fullName,
      phone: a.patient.phone,
      email: a.patient.email,
      dateOfBirth: profile?.dateOfBirth ?? null,
      gender: (profile?.gender as Gender | undefined) ?? null,
      address: profile?.address ?? null,
    },
    notes: a.notes.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt,
      author: { fullName: n.author.fullName, role: n.author.role as Role },
    })),
  };
}

/** Patients get the patient view (no notes); everyone else gets the staff view. */
export function toViewFor(a: AppointmentRecord, viewer: Actor, now: Date) {
  return viewer.role === Role.PATIENT
    ? toAppointmentView(a, viewer, now)
    : toStaffAppointmentView(a, viewer, now);
}
