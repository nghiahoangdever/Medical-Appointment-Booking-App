import { appClock } from '../../clock';
import type { Actor } from '../../domain/appointmentRules';
import { AppointmentAction } from '../../domain/appointmentStateMachine';
import { BOOKING_WINDOW_DAYS } from '../../domain/booking';
import { AppointmentStatus } from '../../domain/enums';
import { conflict, notFound } from '../../domain/errors';
import { addDays, systemClock, today, type Clock } from '../../domain/time';
import { toStaffAppointmentView } from '../appointments/appointment.mapper';
import {
  appointmentRepository,
  type AppointmentRepository,
} from '../appointments/appointment.repository';
import { appointmentService, type AppointmentService } from '../appointments/appointment.service';
import {
  rosterRepository,
  type DutyEntry,
  type RosterRepository,
} from '../roster/roster.repository';

type StatusCounts = Record<AppointmentStatus, number>;

function countStatuses(statuses: AppointmentStatus[]): StatusCounts {
  const counts = Object.fromEntries(
    Object.values(AppointmentStatus).map((s) => [s, 0]),
  ) as StatusCounts;
  for (const s of statuses) counts[s]++;
  return counts;
}

function toDutyShiftView({ appointmentStatuses, doctorUserId: _, ...entry }: DutyEntry) {
  return { ...entry, counts: countStatuses(appointmentStatuses) };
}

/** The doctor's side: duty schedule, shift queue, calling the next patient (UC-D1..D3). */
export class QueueService {
  constructor(
    private readonly roster: RosterRepository,
    private readonly appointments: AppointmentRepository,
    private readonly appointmentService: AppointmentService,
    private readonly clock: Clock = systemClock,
  ) {}

  /** UC-D1: the doctor's shifts from today through the booking window, with per-status counts. */
  async getSchedule(doctor: Actor) {
    const from = today(this.clock());
    const entries = await this.roster.findDutyShifts(
      doctor.id,
      from,
      addDays(from, BOOKING_WINDOW_DAYS - 1),
    );
    return entries.map(toDutyShiftView);
  }

  /**
   * UC-D2: one shift's queue in queue-number order, as staff views with the doctor's
   * allowedActions, plus which appointment "call next" would start (null if none can start)
   * and, if the doctor is examining someone in another shift that day, who that is.
   */
  async getQueue(doctor: Actor, rosterEntryId: number) {
    const entry = await this.ownEntry(doctor, rosterEntryId);
    const now = this.clock();
    const appointments = (await this.appointments.findByRosterEntry(rosterEntryId)).map((a) =>
      toStaffAppointmentView(a, doctor, now),
    );
    const next = appointments.find(
      (a) =>
        a.status === AppointmentStatus.CHECKED_IN &&
        a.allowedActions.includes(AppointmentAction.START),
    );
    const current = await this.appointments.findDoctorInExamination(doctor.id, entry.date);
    const elsewhere = current && current.rosterEntry.id !== rosterEntryId ? current : null;
    return {
      entry: toDutyShiftView(entry),
      appointments,
      nextAppointmentId: next?.id ?? null,
      inExaminationElsewhere: elsewhere && {
        appointmentId: elsewhere.id,
        rosterEntryId: elsewhere.rosterEntry.id,
        queueNumber: elsewhere.queueNumber,
        patientName: elsewhere.patient.fullName,
        shift: {
          id: elsewhere.rosterEntry.shift.id,
          name: elsewhere.rosterEntry.shift.name,
          startTime: elsewhere.rosterEntry.shift.startTime,
          endTime: elsewhere.rosterEntry.shift.endTime,
        },
      },
    };
  }

  /**
   * UC-D3 "Call next patient": the CHECKED_IN appointment with the lowest queue number goes
   * CHECKED_IN → IN_EXAMINATION through AppointmentService.start (state machine + guards).
   */
  async callNext(doctor: Actor, rosterEntryId: number) {
    await this.ownEntry(doctor, rosterEntryId);
    const next = await this.appointments.findFirstCheckedIn(rosterEntryId);
    if (!next) throw conflict('NO_PATIENT_WAITING', 'No checked-in patient is waiting');
    return this.appointmentService.start(doctor, next.id);
  }

  /** Doctors only see their own roster entries; others look nonexistent. */
  private async ownEntry(doctor: Actor, rosterEntryId: number): Promise<DutyEntry> {
    const entry = await this.roster.findDutyEntry(rosterEntryId);
    if (!entry || entry.doctorUserId !== doctor.id) {
      throw notFound('ROSTER_ENTRY_NOT_FOUND', `Roster entry ${rosterEntryId} not found`);
    }
    return entry;
  }
}

export const queueService = new QueueService(
  rosterRepository,
  appointmentRepository,
  appointmentService,
  appClock,
);
