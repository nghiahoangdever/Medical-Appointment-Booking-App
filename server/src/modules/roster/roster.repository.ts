import { prisma, type Db } from '../../db/prisma';
import { AppointmentStatus } from '../../domain/enums';

export interface RosterFilter {
  specialtyId: number;
  doctorId?: number;
  shiftId?: number;
  dateFrom: string;
  dateTo: string;
}

/** A roster entry with what booking needs to know, including how many places are taken. */
export interface RosterSlot {
  id: number;
  date: string;
  doctorId: number;
  doctorName: string;
  shift: { id: number; name: string; startTime: string; endTime: string };
  maxPatients: number;
  /** Non-cancelled appointments (see domain/booking.ts usesCapacity). */
  activeCount: number;
}

/** One duty shift of a doctor, for their schedule and queue header. */
export interface DutyEntry {
  id: number;
  date: string;
  doctorUserId: number;
  doctor: { id: number; fullName: string; title: string };
  specialty: { id: number; name: string };
  shift: { id: number; name: string; startTime: string; endTime: string };
  room: { id: number; code: string; name: string; floor: string | null };
  maxPatients: number;
  /** Status of every appointment in the entry (for per-status counts). */
  appointmentStatuses: AppointmentStatus[];
}

const dutyInclude = {
  shift: true,
  room: true,
  doctor: { include: { user: { select: { fullName: true } }, specialty: true } },
  appointments: { select: { status: true } },
} as const;

type DutyRecord = Awaited<
  ReturnType<typeof prisma.rosterEntry.findFirstOrThrow<{ include: typeof dutyInclude }>>
>;

function toDutyEntry(e: DutyRecord): DutyEntry {
  return {
    id: e.id,
    date: e.date,
    doctorUserId: e.doctor.userId,
    doctor: { id: e.doctor.id, fullName: e.doctor.user.fullName, title: e.doctor.title },
    specialty: { id: e.doctor.specialty.id, name: e.doctor.specialty.name },
    shift: {
      id: e.shift.id,
      name: e.shift.name,
      startTime: e.shift.startTime,
      endTime: e.shift.endTime,
    },
    room: { id: e.room.id, code: e.room.code, name: e.room.name, floor: e.room.floor },
    maxPatients: e.maxPatients,
    appointmentStatuses: e.appointments.map((a) => a.status as AppointmentStatus),
  };
}

export class RosterRepository {
  /** UC-D1: a doctor's roster entries between two dates, earliest first. */
  async findDutyShifts(
    doctorUserId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<DutyEntry[]> {
    const entries = await prisma.rosterEntry.findMany({
      where: { doctor: { userId: doctorUserId }, date: { gte: dateFrom, lte: dateTo } },
      include: dutyInclude,
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }],
    });
    return entries.map(toDutyEntry);
  }

  async findDutyEntry(id: number): Promise<DutyEntry | null> {
    const entry = await prisma.rosterEntry.findUnique({ where: { id }, include: dutyInclude });
    return entry && toDutyEntry(entry);
  }

  /** Roster entries of active doctors in a specialty, with their current booking counts. */
  async findSlots(filter: RosterFilter, db: Db = prisma): Promise<RosterSlot[]> {
    const entries = await db.rosterEntry.findMany({
      where: {
        date: { gte: filter.dateFrom, lte: filter.dateTo },
        shiftId: filter.shiftId,
        doctorId: filter.doctorId,
        doctor: { specialtyId: filter.specialtyId, user: { isActive: true } },
      },
      include: {
        shift: true,
        doctor: { select: { user: { select: { fullName: true } } } },
        _count: {
          select: { appointments: { where: { status: { not: AppointmentStatus.CANCELLED } } } },
        },
      },
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }, { doctorId: 'asc' }],
    });

    return entries.map((e) => ({
      id: e.id,
      date: e.date,
      doctorId: e.doctorId,
      doctorName: e.doctor.user.fullName,
      shift: {
        id: e.shift.id,
        name: e.shift.name,
        startTime: e.shift.startTime,
        endTime: e.shift.endTime,
      },
      maxPatients: e.maxPatients,
      activeCount: e._count.appointments,
    }));
  }

  /** Atomically reserves the entry's next queue number and returns it. Numbers are never reused. */
  async takeNextQueueNumber(rosterEntryId: number, db: Db = prisma): Promise<number> {
    const { nextQueueNumber } = await db.rosterEntry.update({
      where: { id: rosterEntryId },
      data: { nextQueueNumber: { increment: 1 } },
      select: { nextQueueNumber: true },
    });
    return nextQueueNumber - 1;
  }
}

export const rosterRepository = new RosterRepository();
