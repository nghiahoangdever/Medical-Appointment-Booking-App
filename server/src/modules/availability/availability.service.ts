import { BOOKING_WINDOW_DAYS, bookingWindow, remainingSlots } from '../../domain/booking';
import { notFound } from '../../domain/errors';
import { addDays, hasTimePassed, systemClock, type Clock } from '../../domain/time';
import { doctorRepository, type DoctorRepository } from '../doctors/doctor.repository';
import {
  rosterRepository,
  type RosterRepository,
  type RosterSlot,
} from '../roster/roster.repository';
import { specialtyRepository, type SpecialtyRepository } from '../specialties/specialty.repository';

export type ShiftAvailabilityStatus = 'AVAILABLE' | 'FULL' | 'STARTED';

export interface ShiftAvailability {
  shiftId: number;
  name: string;
  startTime: string;
  endTime: string;
  doctorsOnDuty: number;
  remainingSlots: number;
  status: ShiftAvailabilityStatus;
}

export interface DayAvailability {
  date: string;
  /** Empty when nobody matching is on duty that day. */
  shifts: ShiftAvailability[];
}

export class AvailabilityService {
  constructor(
    private readonly specialties: SpecialtyRepository,
    private readonly doctors: DoctorRepository,
    private readonly roster: RosterRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * UC-P3: for every day of the booking window, the shifts with someone on duty for the
   * specialty (or the chosen doctor) and how many places are left across those doctors.
   */
  async getAvailability(specialtyId: number, doctorId?: number) {
    const specialty = await this.specialties.findActiveById(specialtyId);
    if (!specialty) throw notFound('SPECIALTY_NOT_FOUND', `Specialty ${specialtyId} not found`);

    let doctor = null;
    if (doctorId !== undefined) {
      doctor = await this.doctors.findActiveById(doctorId);
      if (!doctor || doctor.specialtyId !== specialtyId) {
        throw notFound(
          'DOCTOR_NOT_FOUND',
          `Doctor ${doctorId} not found in specialty ${specialtyId}`,
        );
      }
    }

    const now = this.clock();
    const window = bookingWindow(now);
    const slots = await this.roster.findSlots({
      specialtyId,
      doctorId,
      dateFrom: window.first,
      dateTo: window.last,
    });

    const days: DayAvailability[] = [];
    for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
      const date = addDays(window.first, i);
      days.push({
        date,
        shifts: summarizeShifts(
          slots.filter((s) => s.date === date),
          now,
        ),
      });
    }

    return {
      specialty: { id: specialty.id, name: specialty.name },
      doctor: doctor && { id: doctor.id, fullName: doctor.fullName, title: doctor.title },
      days,
    };
  }
}

/** Groups one day's roster slots by shift (already sorted by start time). */
function summarizeShifts(slots: RosterSlot[], now: Date): ShiftAvailability[] {
  const byShift = new Map<number, ShiftAvailability>();
  for (const slot of slots) {
    let shift = byShift.get(slot.shift.id);
    if (!shift) {
      shift = {
        shiftId: slot.shift.id,
        name: slot.shift.name,
        startTime: slot.shift.startTime,
        endTime: slot.shift.endTime,
        doctorsOnDuty: 0,
        remainingSlots: 0,
        status: 'AVAILABLE',
      };
      byShift.set(slot.shift.id, shift);
    }
    shift.doctorsOnDuty++;
    shift.remainingSlots += remainingSlots(slot);
  }

  for (const shift of byShift.values()) {
    if (hasTimePassed(slots[0].date, shift.startTime, now)) shift.status = 'STARTED';
    else if (shift.remainingSlots === 0) shift.status = 'FULL';
  }
  return [...byShift.values()];
}

export const availabilityService = new AvailabilityService(
  specialtyRepository,
  doctorRepository,
  rosterRepository,
);
