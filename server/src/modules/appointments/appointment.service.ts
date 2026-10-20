import type { Prisma } from '@prisma/client';
import { guardFailure, type Actor } from '../../domain/appointmentRules';
import { AppointmentAction, transition } from '../../domain/appointmentStateMachine';
import { Role, type AppointmentStatus } from '../../domain/enums';
import { conflict, forbidden, notFound } from '../../domain/errors';
import { systemClock, type Clock } from '../../domain/time';
import { appClock } from '../../clock';
import {
  appointmentFacts,
  toAppointmentView,
  toStaffAppointmentView,
  toViewFor,
  type AppointmentView,
  type StaffAppointmentView,
} from './appointment.mapper';
import {
  appointmentRepository,
  type AppointmentRecord,
  type AppointmentRepository,
  type StaffAppointmentFilter,
} from './appointment.repository';
import { noteRepository, type NoteRepository } from './note.repository';

export type { Actor };

/** Timestamps and extra fields written alongside a status change. */
type StatusChangeData = Omit<Prisma.AppointmentUncheckedUpdateInput, 'id' | 'status'>;

/** Viewing appointments, moving them through the state machine, and staff notes. */
export class AppointmentService {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly notes: NoteRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** UC-P5: the patient's own appointments, soonest first. */
  async listForPatient(patientId: number): Promise<AppointmentView[]> {
    const now = this.clock();
    const viewer = { id: patientId, role: Role.PATIENT };
    const appointments = await this.appointments.findByPatient(patientId);
    return appointments.map((a) => toAppointmentView(a, viewer, now));
  }

  /** UC-R1 / UC-R2: appointments matching the filters, plus per-status counts for the same filters. */
  async listForStaff(
    viewer: Actor,
    filter: StaffAppointmentFilter,
  ): Promise<{ appointments: StaffAppointmentView[]; counts: Record<AppointmentStatus, number> }> {
    const now = this.clock();
    const [appointments, counts] = await Promise.all([
      this.appointments.findForStaff(filter),
      this.appointments.countByStatus(filter),
    ]);
    return {
      appointments: appointments.map((a) => toStaffAppointmentView(a, viewer, now)),
      counts,
    };
  }

  /** UC-P7 / UC-R4: BOOKED → CANCELLED. Patients: own appointment, before the shift starts. */
  cancel(actor: Actor, appointmentId: number, reason?: string) {
    return this.perform(actor, appointmentId, AppointmentAction.CANCEL, (now) => ({
      cancelledAt: now,
      cancelledById: actor.id,
      cancelReason: reason ?? null,
    }));
  }

  /** UC-R3: BOOKED → CHECKED_IN, on the appointment date before the shift ends. */
  checkIn(actor: Actor, appointmentId: number) {
    return this.perform(actor, appointmentId, AppointmentAction.CHECK_IN, (now) => ({
      checkedInAt: now,
    }));
  }

  /** UC-R5: BOOKED → NO_SHOW, once the shift has started. */
  markNoShow(actor: Actor, appointmentId: number) {
    return this.perform(actor, appointmentId, AppointmentAction.MARK_NO_SHOW, () => ({}));
  }

  /** UC-R7: add an internal staff note (any status). */
  async addNote(
    actor: Actor,
    appointmentId: number,
    content: string,
  ): Promise<StaffAppointmentView> {
    if (actor.role === Role.PATIENT) {
      throw forbidden('ACTION_NOT_ALLOWED_FOR_ROLE', 'Patients cannot add notes');
    }
    const appointment = await this.findVisibleTo(actor, appointmentId);
    const now = this.clock();
    await this.notes.create({ appointmentId, authorId: actor.id, content, createdAt: now });
    return toStaffAppointmentView((await this.appointments.findById(appointment.id))!, actor, now);
  }

  /**
   * One status change, following the state diagram:
   * load → transition() (status + role) → guards (time, ownership) → conditional update.
   */
  private async perform(
    actor: Actor,
    appointmentId: number,
    action: AppointmentAction,
    extraData: (now: Date) => StatusChangeData,
  ) {
    const appointment = await this.findVisibleTo(actor, appointmentId);
    const from = appointment.status as AppointmentStatus;
    const to = transition(from, action, actor.role);

    const now = this.clock();
    const blocked = guardFailure(appointmentFacts(appointment), action, actor, now);
    if (blocked) throw blocked;

    const updated = await this.appointments.updateStatus(appointment.id, from, {
      status: to,
      ...extraData(now),
    });
    if (!updated) {
      throw conflict(
        'APPOINTMENT_CHANGED',
        'The appointment was changed by someone else; refresh and retry',
      );
    }
    return toViewFor((await this.appointments.findById(appointment.id))!, actor, now);
  }

  /** Patients only see their own appointments; for them, others' ids look nonexistent. */
  private async findVisibleTo(actor: Actor, appointmentId: number): Promise<AppointmentRecord> {
    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment || (actor.role === Role.PATIENT && appointment.patientId !== actor.id)) {
      throw notFound('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} not found`);
    }
    return appointment;
  }
}

export const appointmentService = new AppointmentService(
  appointmentRepository,
  noteRepository,
  appClock,
);
