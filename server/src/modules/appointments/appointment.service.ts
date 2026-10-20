import type { Prisma } from '@prisma/client';
import { guardFailure, type Actor } from '../../domain/appointmentRules';
import { AppointmentAction, transition } from '../../domain/appointmentStateMachine';
import { Role, type AppointmentStatus } from '../../domain/enums';
import { conflict, forbidden, notFound } from '../../domain/errors';
import { systemClock, type Clock } from '../../domain/time';
import { appClock } from '../../clock';
import { runInTransaction, type Db } from '../../db/prisma';
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

  /**
   * UC-R5 / UC-D6: → NO_SHOW once the shift has started.
   * Reception: BOOKED. Doctor: BOOKED or CHECKED_IN, own queue only.
   */
  markNoShow(actor: Actor, appointmentId: number) {
    return this.perform(actor, appointmentId, AppointmentAction.MARK_NO_SHOW, () => ({}));
  }

  /**
   * UC-D3 / UC-D4: CHECKED_IN → IN_EXAMINATION (own queue, today, and the doctor is not
   * examining anyone else that day in any of their shifts).
   */
  start(actor: Actor, appointmentId: number) {
    return this.perform(actor, appointmentId, AppointmentAction.START, (now) => ({
      startedAt: now,
    }));
  }

  /** UC-D5: IN_EXAMINATION → COMPLETED (own queue). */
  complete(actor: Actor, appointmentId: number) {
    return this.perform(actor, appointmentId, AppointmentAction.COMPLETE, (now) => ({
      completedAt: now,
    }));
  }

  /** UC-R7 / UC-D8: add an internal staff note (any status). */
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
   * load → transition() (status + role) → guards (time, ownership, one exam at a time) →
   * conditional update. Runs in a transaction so guards that look at other appointments
   * (DOCTOR_BUSY) can't be raced by a concurrent request.
   */
  private async perform(
    actor: Actor,
    appointmentId: number,
    action: AppointmentAction,
    extraData: (now: Date) => StatusChangeData,
  ) {
    const now = this.clock();
    await runInTransaction(async (tx) => {
      const appointment = await this.findVisibleTo(actor, appointmentId, tx);
      const from = appointment.status as AppointmentStatus;
      const to = transition(from, action, actor.role);

      const blocked = guardFailure(appointmentFacts(appointment), action, actor, now);
      if (blocked) throw blocked;

      const updated = await this.appointments.updateStatus(
        appointment.id,
        from,
        { status: to, ...extraData(now) },
        tx,
      );
      if (!updated) {
        throw conflict(
          'APPOINTMENT_CHANGED',
          'The appointment was changed by someone else; refresh and retry',
        );
      }
    });
    return toViewFor((await this.appointments.findById(appointmentId))!, actor, now);
  }

  /**
   * Patients see only their own appointments, doctors only those in their own roster entries;
   * anything else looks nonexistent (404). Reception and admin see everything.
   */
  private async findVisibleTo(
    actor: Actor,
    appointmentId: number,
    db?: Db,
  ): Promise<AppointmentRecord> {
    const appointment = await this.appointments.findById(appointmentId, db);
    const hidden =
      !appointment ||
      (actor.role === Role.PATIENT && appointment.patientId !== actor.id) ||
      (actor.role === Role.DOCTOR && appointment.rosterEntry.doctor.userId !== actor.id);
    if (hidden) {
      throw notFound('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} not found`);
    }
    return appointment!;
  }
}

export const appointmentService = new AppointmentService(
  appointmentRepository,
  noteRepository,
  appClock,
);
