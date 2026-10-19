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

export class RosterRepository {
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
