import type { Prisma } from '@prisma/client';
import { prisma, type Db } from '../../db/prisma';
import { AppointmentStatus } from '../../domain/enums';

/**
 * Everything needed to show an appointment: roster entry → shift, room, doctor, specialty;
 * the patient with their profile; and staff notes. The mapper decides what each viewer sees.
 */
export const appointmentDetailInclude = {
  rosterEntry: {
    include: {
      shift: true,
      room: true,
      doctor: { include: { user: { select: { fullName: true } }, specialty: true } },
    },
  },
  patient: {
    select: { id: true, fullName: true, phone: true, email: true, patientProfile: true },
  },
  notes: {
    include: { author: { select: { fullName: true, role: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
  bookedAt: Date;
}

/** Filters for the staff appointment list (UC-R1 / UC-R2). */
export interface StaffAppointmentFilter {
  date?: string;
  shiftId?: number;
  specialtyId?: number;
  doctorId?: number;
  status?: AppointmentStatus;
  /** Part of an appointment code or a patient's phone number. */
  query?: string;
}

const STAFF_LIST_LIMIT = 200;

function staffWhere(filter: Omit<StaffAppointmentFilter, 'status'>): Prisma.AppointmentWhereInput {
  const query = filter.query;
  return {
    rosterEntry: {
      date: filter.date,
      shiftId: filter.shiftId,
      doctorId: filter.doctorId,
      doctor: filter.specialtyId ? { specialtyId: filter.specialtyId } : undefined,
    },
    OR: query
      ? [{ code: { contains: query.toUpperCase() } }, { patient: { phone: { contains: query } } }]
      : undefined,
  };
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

  /** Appointments matching the staff filters, in date → shift → doctor → queue order. */
  findForStaff(filter: StaffAppointmentFilter): Promise<AppointmentRecord[]> {
    return prisma.appointment.findMany({
      where: { ...staffWhere(filter), status: filter.status },
      include: appointmentDetailInclude,
      orderBy: [
        { rosterEntry: { date: 'asc' } },
        { rosterEntry: { shift: { startTime: 'asc' } } },
        { rosterEntry: { doctorId: 'asc' } },
        { queueNumber: 'asc' },
      ],
      take: STAFF_LIST_LIMIT,
    });
  }

  /** How many appointments per status match the filters (ignoring the status filter). */
  async countByStatus(filter: StaffAppointmentFilter): Promise<Record<AppointmentStatus, number>> {
    const groups = await prisma.appointment.groupBy({
      by: ['status'],
      where: staffWhere(filter),
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      Object.values(AppointmentStatus).map((s) => [s, 0]),
    ) as Record<AppointmentStatus, number>;
    for (const g of groups) counts[g.status as AppointmentStatus] = g._count._all;
    return counts;
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
