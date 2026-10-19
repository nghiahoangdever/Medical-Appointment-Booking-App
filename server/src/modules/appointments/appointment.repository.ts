import type { Prisma } from '@prisma/client';
import { prisma, type Db } from '../../db/prisma';
import { AppointmentStatus } from '../../domain/enums';

/** Everything needed to show an appointment: roster entry → shift, room, doctor, specialty. */
export const appointmentDetailInclude = {
  rosterEntry: {
    include: {
      shift: true,
      room: true,
      doctor: { include: { user: { select: { fullName: true } }, specialty: true } },
    },
  },
} satisfies Prisma.AppointmentInclude;

export type AppointmentRecord = Prisma.AppointmentGetPayload<{
  include: typeof appointmentDetailInclude;
}>;

export interface NewAppointment {
  code: string;
  patientId: number;
  rosterEntryId: number;
  queueNumber: number;
  status: AppointmentStatus;
  reason?: string;
}

export class AppointmentRepository {
  findById(id: number, db: Db = prisma): Promise<AppointmentRecord | null> {
    return db.appointment.findUnique({ where: { id }, include: appointmentDetailInclude });
  }

  /** A patient's appointments, soonest first. */
  findByPatient(patientId: number): Promise<AppointmentRecord[]> {
    return prisma.appointment.findMany({
      where: { patientId },
      include: appointmentDetailInclude,
      orderBy: [
        { rosterEntry: { date: 'asc' } },
        { rosterEntry: { shift: { startTime: 'asc' } } },
        { queueNumber: 'asc' },
      ],
    });
  }

  /** The patient's non-cancelled appointment on this date + shift, if any. */
  findActiveForPatientInSlot(patientId: number, date: string, shiftId: number, db: Db = prisma) {
    return db.appointment.findFirst({
      where: {
        patientId,
        status: { not: AppointmentStatus.CANCELLED },
        rosterEntry: { date, shiftId },
      },
      select: { id: true },
    });
  }

  async codeExists(code: string, db: Db = prisma): Promise<boolean> {
    return (await db.appointment.count({ where: { code } })) > 0;
  }

  create(data: NewAppointment, db: Db = prisma): Promise<AppointmentRecord> {
    return db.appointment.create({ data, include: appointmentDetailInclude });
  }

  /**
   * Changes status only if it is still `from` (optimistic check against concurrent updates).
   * Returns false if someone else changed it first.
   */
  async updateStatus(
    id: number,
    from: AppointmentStatus,
    data: Omit<Prisma.AppointmentUncheckedUpdateInput, 'id'> & { status: AppointmentStatus },
    db: Db = prisma,
  ): Promise<boolean> {
    const { count } = await db.appointment.updateMany({ where: { id, status: from }, data });
    return count === 1;
  }
}

export const appointmentRepository = new AppointmentRepository();
