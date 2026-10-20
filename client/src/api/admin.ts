import type {
  AdminDoctor,
  AdminRoom,
  AdminSpecialty,
  CopyWeekResult,
  RosterEntry,
  RosterWeek,
  Shift,
  StaffAccount,
} from '../types';
import { http } from './http';

/** Activate / deactivate are action endpoints: POST /admin/<resource>/:id/(activate|deactivate). */
const setActive =
  <T>(resource: string, key: string) =>
  (id: number, active: boolean) =>
    http
      .post<Record<string, T>>(`/admin/${resource}/${id}/${active ? 'activate' : 'deactivate'}`)
      .then((r) => r[key]);

export interface AccountForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export const adminApi = {
  // UC-A1
  specialties: () => http.get<{ specialties: AdminSpecialty[] }>('/admin/specialties'),
  createSpecialty: (data: { name: string; description: string }) =>
    http.post<{ specialty: AdminSpecialty }>('/admin/specialties', data),
  updateSpecialty: (id: number, data: { name?: string; description?: string }) =>
    http.patch<{ specialty: AdminSpecialty }>(`/admin/specialties/${id}`, data),
  setSpecialtyActive: setActive<AdminSpecialty>('specialties', 'specialty'),

  // UC-A2
  rooms: () => http.get<{ rooms: AdminRoom[] }>('/admin/rooms'),
  createRoom: (data: { code: string; name: string; floor: string }) =>
    http.post<{ room: AdminRoom }>('/admin/rooms', data),
  updateRoom: (id: number, data: { code?: string; name?: string; floor?: string }) =>
    http.patch<{ room: AdminRoom }>(`/admin/rooms/${id}`, data),
  setRoomActive: setActive<AdminRoom>('rooms', 'room'),

  // UC-A3
  doctors: () => http.get<{ doctors: AdminDoctor[] }>('/admin/doctors'),
  createDoctor: (data: AccountForm & { specialtyId: number; title: string; bio: string }) =>
    http.post<{ doctor: AdminDoctor }>('/admin/doctors', data),
  updateDoctor: (id: number, data: Partial<AccountForm> & { title?: string; bio?: string }) =>
    http.patch<{ doctor: AdminDoctor }>(`/admin/doctors/${id}`, data),
  setDoctorActive: setActive<AdminDoctor>('doctors', 'doctor'),

  // UC-A4
  receptionists: () => http.get<{ receptionists: StaffAccount[] }>('/admin/receptionists'),
  createReceptionist: (data: AccountForm) =>
    http.post<{ receptionist: StaffAccount }>('/admin/receptionists', data),
  updateReceptionist: (id: number, data: Partial<AccountForm>) =>
    http.patch<{ receptionist: StaffAccount }>(`/admin/receptionists/${id}`, data),
  setReceptionistActive: setActive<StaffAccount>('receptionists', 'receptionist'),

  // UC-A5
  updateShiftTimes: (id: number, times: { startTime: string; endTime: string }) =>
    http.patch<{ shift: Shift }>(`/admin/shifts/${id}`, times),

  // UC-A6 / UC-A7
  rosterWeek: (weekStart: string) => http.get<RosterWeek>(`/admin/roster?weekStart=${weekStart}`),
  createRosterEntry: (data: {
    doctorId: number;
    roomId: number;
    shiftId: number;
    date: string;
    maxPatients: number;
  }) => http.post<{ entry: RosterEntry }>('/admin/roster-entries', data),
  updateRosterEntry: (id: number, data: { roomId?: number; maxPatients?: number }) =>
    http.patch<{ entry: RosterEntry }>(`/admin/roster-entries/${id}`, data),
  deleteRosterEntry: (id: number) => http.delete<null>(`/admin/roster-entries/${id}`),
  copyPreviousWeek: (weekStart: string) =>
    http.post<CopyWeekResult>('/admin/roster/copy-previous-week', { weekStart }),
};
