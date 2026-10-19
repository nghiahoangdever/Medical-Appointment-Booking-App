// Enum-like value sets shared by every layer. Stored as strings in SQLite.

export const Role = {
  PATIENT: 'PATIENT',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const AppointmentStatus = {
  BOOKED: 'BOOKED',
  CHECKED_IN: 'CHECKED_IN',
  IN_EXAMINATION: 'IN_EXAMINATION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];
