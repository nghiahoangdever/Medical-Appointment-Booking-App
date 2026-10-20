import type {
  Appointment,
  BookingInput,
  StaffAppointment,
  StaffAppointmentFilters,
  StatusCounts,
} from '../types';
import { http } from './http';

const action = <T extends Appointment>(id: number, name: string, body?: unknown) =>
  http.post<{ appointment: T }>(`/appointments/${id}/${name}`, body);

export const appointmentsApi = {
  // Patient
  book: (input: BookingInput) => http.post<{ appointment: Appointment }>('/appointments', input),
  mine: () => http.get<{ appointments: Appointment[] }>('/appointments/mine'),

  // Staff
  listForStaff: (filters: StaffAppointmentFilters) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    return http.get<{ appointments: StaffAppointment[]; counts: StatusCounts }>(
      `/appointments?${query}`,
    );
  },
  addNote: (id: number, content: string) =>
    http.post<{ appointment: StaffAppointment }>(`/appointments/${id}/notes`, { content }),

  // State-machine actions (one endpoint each). Patients get Appointment, staff StaffAppointment.
  cancel: <T extends Appointment = Appointment>(id: number, reason?: string) =>
    action<T>(id, 'cancel', { reason }),
  checkIn: (id: number) => action<StaffAppointment>(id, 'check-in'),
  markNoShow: (id: number) => action<StaffAppointment>(id, 'no-show'),
  start: (id: number) => action<StaffAppointment>(id, 'start'),
  complete: (id: number) => action<StaffAppointment>(id, 'complete'),
};
