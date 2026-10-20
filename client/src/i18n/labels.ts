// Vietnamese labels for values that the API sends as English codes.

import type { AppointmentStatus, Gender, Role } from '../types';

export const ROLE_LABEL: Record<Role, string> = {
  PATIENT: 'Bệnh nhân',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  ADMIN: 'Quản trị viên',
};

export const GENDER_LABEL: Record<Gender, string> = {
  FEMALE: 'Nữ',
  MALE: 'Nam',
  OTHER: 'Khác',
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: 'Đã đặt',
  CHECKED_IN: 'Đã check-in',
  IN_EXAMINATION: 'Đang khám',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Vắng mặt',
};

// Shift names are fixed identifiers in the database.
const SHIFT_LABEL: Record<string, string> = {
  Morning: 'Ca sáng',
  Afternoon: 'Ca chiều',
};

export function shiftLabel(name: string): string {
  return SHIFT_LABEL[name] ?? name;
}

/** Compact form for grid headers: "Sáng" / "Chiều". */
export function shiftShortLabel(name: string): string {
  return shiftLabel(name)
    .replace(/^Ca /, '')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Active / inactive label for admin lists. */
export function activeLabel(isActive: boolean): string {
  return isActive ? 'Đang hoạt động' : 'Ngừng hoạt động';
}

/** e.g. "BS.CKI Trần Thị Linh". */
export function doctorName(doctor: { title: string; fullName: string }): string {
  return `${doctor.title} ${doctor.fullName}`;
}
