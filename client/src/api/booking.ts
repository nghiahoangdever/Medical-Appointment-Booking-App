// Reference data used by booking and by staff filters.

import type { Availability, Doctor, Shift, Specialty } from '../types';
import { http } from './http';

export const specialtiesApi = {
  list: () => http.get<{ specialties: Specialty[] }>('/specialties'),
  doctors: (specialtyId: number) =>
    http.get<{ doctors: Doctor[] }>(`/specialties/${specialtyId}/doctors`),
};

export const shiftsApi = {
  list: () => http.get<{ shifts: Shift[] }>('/shifts'),
};

export const availabilityApi = {
  get: (specialtyId: number, doctorId?: number) => {
    const query = new URLSearchParams({ specialtyId: String(specialtyId) });
    if (doctorId !== undefined) query.set('doctorId', String(doctorId));
    return http.get<Availability>(`/availability?${query}`);
  },
};
