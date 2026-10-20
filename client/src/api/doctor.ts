import type { DoctorQueue, DutyShift, StaffAppointment } from '../types';
import { http } from './http';

export const doctorApi = {
  schedule: () => http.get<{ shifts: DutyShift[] }>('/doctor/schedule'),
  queue: (rosterEntryId: number) => http.get<DoctorQueue>(`/roster-entries/${rosterEntryId}/queue`),
  callNext: (rosterEntryId: number) =>
    http.post<{ appointment: StaffAppointment }>(`/roster-entries/${rosterEntryId}/call-next`),
};
