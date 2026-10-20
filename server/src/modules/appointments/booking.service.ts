import { appClock } from '../../clock';
import { runInTransaction, type Db } from '../../db/prisma';
import { Role } from '../../domain/enums';
import { INITIAL_STATUS } from '../../domain/appointmentStateMachine';
import { bookingWindow, generateAppointmentCode, pickLeastBooked } from '../../domain/booking';
import { badRequest, conflict, notFound } from '../../domain/errors';
import { hasTimePassed, systemClock, type Clock } from '../../domain/time';
import { rosterRepository, type RosterRepository } from '../roster/roster.repository';
import { shiftRepository, type ShiftRepository } from '../shifts/shift.repository';
import { toAppointmentView, type AppointmentView } from './appointment.mapper';
import { appointmentRepository, type AppointmentRepository } from './appointment.repository';

export interface BookingRequest {
  specialtyId: number;
  date: string;
  shiftId: number;
  /** Omitted → the least-booked doctor of the specialty on duty is assigned. */
  doctorId?: number;
  reason?: string;
}

const CODE_ATTEMPTS = 5;

/** UC-P4 "Book appointment" — see the "patient books an appointment" sequence diagram. */
export class BookingService {
  constructor(
    private readonly roster: RosterRepository,
    private readonly appointments: AppointmentRepository,
    private readonly shifts: ShiftRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async book(patientId: number, req: BookingRequest): Promise<AppointmentView> {
    const now = this.clock();

    // 1. The date is inside the booking window and the shift hasn't started.
    const window = bookingWindow(now);
    if (req.date < window.first) throw badRequest('DATE_IN_PAST', 'Cannot book a past date');
    if (req.date > window.last) {
      throw badRequest('DATE_OUTSIDE_BOOKING_WINDOW', `Bookings open up to ${window.last}`);
    }
    const shift = await this.shifts.findById(req.shiftId);
    if (!shift) throw notFound('SHIFT_NOT_FOUND', `Shift ${req.shiftId} not found`);
    if (hasTimePassed(req.date, shift.startTime, now)) {
      throw badRequest('SHIFT_ALREADY_STARTED', 'This shift has already started');
    }

    // Steps 2–8 run in one transaction so capacity and queue numbers stay consistent.
    const appointment = await runInTransaction(async (tx) => {
      // 2. One active appointment per patient per date + shift.
      if (
        await this.appointments.findActiveForPatientInSlot(patientId, req.date, req.shiftId, tx)
      ) {
        throw conflict('DUPLICATE_BOOKING', 'You already have an appointment in this shift');
      }

      // 3–5. Roster entries on duty → those with room left → least booked.
      const candidates = await this.roster.findSlots(
        {
          specialtyId: req.specialtyId,
          doctorId: req.doctorId,
          shiftId: req.shiftId,
          dateFrom: req.date,
          dateTo: req.date,
        },
        tx,
      );
      if (candidates.length === 0) {
        throw notFound('NO_DOCTOR_ON_DUTY', 'No matching doctor is on duty in this shift');
      }
      const chosen = pickLeastBooked(candidates);
      if (!chosen) throw conflict('SHIFT_FULL', 'This shift is fully booked');

      // 6–8. Queue number, code, appointment.
      const queueNumber = await this.roster.takeNextQueueNumber(chosen.id, tx);
      return this.appointments.create(
        {
          code: await this.newCode(tx),
          patientId,
          rosterEntryId: chosen.id,
          queueNumber,
          status: INITIAL_STATUS,
          reason: req.reason,
          bookedAt: now,
        },
        tx,
      );
    });

    return toAppointmentView(appointment, { id: patientId, role: Role.PATIENT }, now);
  }

  private async newCode(db: Db): Promise<string> {
    for (let i = 0; i < CODE_ATTEMPTS; i++) {
      const code = generateAppointmentCode();
      if (!(await this.appointments.codeExists(code, db))) return code;
    }
    throw new Error('Could not generate a unique appointment code');
  }
}

export const bookingService = new BookingService(
  rosterRepository,
  appointmentRepository,
  shiftRepository,
  appClock,
);
