// Shapes returned by the API (mirrors server/src/domain and the services' views).

export type Role = 'PATIENT' | 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type AppointmentStatus =
  'BOOKED' | 'CHECKED_IN' | 'IN_EXAMINATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string;
}

export interface Specialty {
  id: number;
  name: string;
  description: string | null;
}

export interface Doctor {
  id: number;
  fullName: string;
  title: string;
  bio: string | null;
  specialtyId: number;
}

export interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

export interface Appointment {
  id: number;
  code: string;
  queueNumber: number;
  status: AppointmentStatus;
  reason: string | null;
  date: string;
  shift: Shift;
  specialty: { id: number; name: string };
  doctor: { id: number; fullName: string; title: string };
  room: { id: number; code: string; name: string; floor: string | null };
  bookedAt: string;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** What the current user may do now (decided by the server: state machine + time rules). */
  allowedActions: AppointmentAction[];
}

export type AppointmentAction = 'CANCEL' | 'CHECK_IN' | 'START' | 'COMPLETE' | 'MARK_NO_SHOW';

export interface AppointmentNote {
  id: number;
  content: string;
  createdAt: string;
  author: { fullName: string; role: Role };
}

export interface PatientDetails {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  address: string | null;
}

/** What staff see: the appointment plus the patient and internal notes. */
export interface StaffAppointment extends Appointment {
  patient: PatientDetails;
  notes: AppointmentNote[];
}

export type StatusCounts = Record<AppointmentStatus, number>;

/** One of the doctor's roster entries (UC-D1), with per-status appointment counts. */
export interface DutyShift {
  id: number;
  date: string;
  doctor: { id: number; fullName: string; title: string };
  specialty: { id: number; name: string };
  shift: Shift;
  room: { id: number; code: string; name: string; floor: string | null };
  maxPatients: number;
  counts: StatusCounts;
}

/** UC-D2: a shift's queue. `nextAppointmentId` is who "call next" would start (null: nobody). */
export interface DoctorQueue {
  entry: DutyShift;
  appointments: StaffAppointment[];
  nextAppointmentId: number | null;
  /** The doctor's patient in examination in another shift that day (blocks this queue). */
  inExaminationElsewhere: {
    appointmentId: number;
    rosterEntryId: number;
    queueNumber: number;
    patientName: string;
    shift: Shift;
  } | null;
}

export interface StaffAppointmentFilters {
  date?: string;
  shiftId?: number;
  specialtyId?: number;
  doctorId?: number;
  status?: AppointmentStatus;
  /** Part of an appointment code or a phone number; searches all dates. */
  q?: string;
}

export type ShiftAvailabilityStatus = 'AVAILABLE' | 'FULL' | 'STARTED';

export interface ShiftAvailability {
  shiftId: number;
  name: string;
  startTime: string;
  endTime: string;
  doctorsOnDuty: number;
  remainingSlots: number;
  status: ShiftAvailabilityStatus;
}

export interface DayAvailability {
  date: string;
  shifts: ShiftAvailability[];
}

export interface Availability {
  specialty: { id: number; name: string };
  doctor: { id: number; fullName: string; title: string } | null;
  days: DayAvailability[];
}

export interface BookingInput {
  specialtyId: number;
  doctorId?: number;
  date: string;
  shiftId: number;
  reason?: string;
}

// Admin (Phase 5)

export interface AdminSpecialty {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  activeDoctorCount: number;
}

export interface AdminRoom {
  id: number;
  code: string;
  name: string;
  floor: string | null;
  isActive: boolean;
}

export interface AdminDoctor {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  title: string;
  bio: string | null;
  specialty: { id: number; name: string; isActive: boolean };
}

export interface StaffAccount {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
}

/** A roster entry in the admin week editor; `editable` / `deletable` / `minMaxPatients` come from the server. */
export interface RosterEntry {
  id: number;
  date: string;
  shiftId: number;
  roomId: number;
  doctor: {
    id: number;
    fullName: string;
    title: string;
    isActive: boolean;
    specialty: { id: number; name: string };
  };
  maxPatients: number;
  activeCount: number;
  appointmentCount: number;
  editable: boolean;
  deletable: boolean;
  minMaxPatients: number;
}

export interface RosterWeek {
  weekStart: string;
  weekEnd: string;
  /** `editable`: entries can be added or changed on that day. */
  days: { date: string; editable: boolean }[];
  shifts: Shift[];
  rooms: AdminRoom[];
  doctors: {
    id: number;
    fullName: string;
    title: string;
    specialty: { id: number; name: string };
  }[];
  entries: RosterEntry[];
}

export interface CopyWeekResult {
  sourceWeekStart: string;
  created: number;
  skipped: {
    sourceEntryId: number;
    date: string;
    shiftId: number;
    roomId: number;
    doctorName: string;
    /** Error code. */
    reason: string;
  }[];
}
