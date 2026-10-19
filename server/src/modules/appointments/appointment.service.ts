import { AppointmentAction, transition } from '../../domain/appointmentStateMachine';
import { Role, type AppointmentStatus } from '../../domain/enums';
import { conflict, notFound } from '../../domain/errors';
import { hasTimePassed, systemClock, type Clock } from '../../domain/time';
import { toAppointmentView, type AppointmentView } from './appointment.mapper';
import {
  appointmentRepository,
  type AppointmentRecord,
  type AppointmentRepository,
} from './appointment.repository';

export interface Actor {
  id: number;
  role: Role;
}

/** Viewing appointments and moving them through the state machine. */
export class AppointmentService {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** UC-P5: the patient's own appointments, soonest first. */
  async listForPatient(patientId: number): Promise<AppointmentView[]> {
    const appointments = await this.appointments.findByPatient(patientId);
    return appointments.map(toAppointmentView);
  }

  /**
   * UC-P7 / UC-R4: BOOKED → CANCELLED.
   * Patients may cancel only their own appointments, and only before the shift starts.
   */
  async cancel(actor: Actor, appointmentId: number, reason?: string): Promise<AppointmentView> {
    const appointment = await this.findVisibleTo(actor, appointmentId);
    const from = appointment.status as AppointmentStatus;
    const to = transition(from, AppointmentAction.CANCEL, actor.role);

    const now = this.clock();
    const { date, shift } = appointment.rosterEntry;
    if (actor.role === Role.PATIENT && hasTimePassed(date, shift.startTime, now)) {
      throw conflict(
        'CANCEL_DEADLINE_PASSED',
        'Appointments can only be cancelled before the shift starts',
      );
    }

    return this.applyStatusChange(appointment, from, {
      status: to,
      cancelledAt: now,
      cancelledById: actor.id,
      cancelReason: reason ?? null,
    });
  }

  /** Patients only see their own appointments; for them, others' ids look nonexistent. */
  private async findVisibleTo(actor: Actor, appointmentId: number): Promise<AppointmentRecord> {
    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment || (actor.role === Role.PATIENT && appointment.patientId !== actor.id)) {
      throw notFound('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} not found`);
    }
    return appointment;
  }

  private async applyStatusChange(
    appointment: AppointmentRecord,
    from: AppointmentStatus,
    data: Parameters<AppointmentRepository['updateStatus']>[2],
  ): Promise<AppointmentView> {
    const updated = await this.appointments.updateStatus(appointment.id, from, data);
    if (!updated) {
      throw conflict(
        'APPOINTMENT_CHANGED',
        'The appointment was changed by someone else; refresh and retry',
      );
    }
    const fresh = await this.appointments.findById(appointment.id);
    return toAppointmentView(fresh!);
  }
}

export const appointmentService = new AppointmentService(appointmentRepository);
