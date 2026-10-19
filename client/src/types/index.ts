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
