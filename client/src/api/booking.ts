import type { Appointment, Availability, BookingInput, Doctor, Specialty } from '../types';
import { http } from './http';

export const specialtiesApi = {
  list: () => http.get<{ specialties: Specialty[] }>('/specialties'),
  doctors: (specialtyId: number) =>
    http.get<{ doctors: Doctor[] }>(`/specialties/${specialtyId}/doctors`),
};

export const availabilityApi = {
  get: (specialtyId: number, doctorId?: number) => {
    const query = new URLSearchParams({ specialtyId: String(specialtyId) });
    if (doctorId !== undefined) query.set('doctorId', String(doctorId));
    return http.get<Availability>(`/availability?${query}`);
  },
};

export const appointmentsApi = {
  book: (input: BookingInput) => http.post<{ appointment: Appointment }>('/appointments', input),
  mine: () => http.get<{ appointments: Appointment[] }>('/appointments/mine'),
  cancel: (id: number, reason?: string) =>
    http.post<{ appointment: Appointment }>(`/appointments/${id}/cancel`, { reason }),
};
