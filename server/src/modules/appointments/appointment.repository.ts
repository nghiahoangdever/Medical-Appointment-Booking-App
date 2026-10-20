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

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentDetailInclude }>;

/**
 * An appointment as every repository read returns it. `doctorInExamination` is how many
 * appointments the same doctor has IN_EXAMINATION on the same date, across all their shifts
 * (for the "one patient at a time per doctor" guard).
 */
export type AppointmentRecord = AppointmentRow & { doctorInExamination: number };

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

const doctorDayKey = (doctorId: number, date: string) => `${doctorId}|${date}`;

/** Adds `doctorInExamination` to rows with one extra query for all (doctor, date) pairs. */
async function withDoctorLoad(rows: AppointmentRow[], db: Db): Promise<AppointmentRecord[]> {
  if (rows.length === 0) return [];
  const pairs = new Map(
    rows.map((r) => [
      doctorDayKey(r.rosterEntry.doctorId, r.rosterEntry.date),
      { doctorId: r.rosterEntry.doctorId, date: r.rosterEntry.date },
    ]),
  );
  const inExamination = await db.appointment.findMany({
    where: { status: AppointmentStatus.IN_EXAMINATION, rosterEntry: { OR: [...pairs.values()] } },
    select: { rosterEntry: { select: { doctorId: true, date: true } } },
  });
  const counts = new Map<string, number>();
  for (const { rosterEntry: e } of inExamination) {
    const key = doctorDayKey(e.doctorId, e.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rows.map((r) => ({
    ...r,
    doctorInExamination: counts.get(doctorDayKey(r.rosterEntry.doctorId, r.rosterEntry.date)) ?? 0,
  }));
}

export class AppointmentRepository {
  async findById(id: number, db: Db = prisma): Promise<AppointmentRecord | null> {
    const row = await db.appointment.findUnique({
      where: { id },
      include: appointmentDetailInclude,
    });
    return row && (await withDoctorLoad([row], db))[0];
  }

  /** A patient's appointments, soonest first. */
  async findByPatient(patientId: number): Promise<AppointmentRecord[]> {
    const rows = await prisma.appointment.findMany({
      where: { patientId },
      include: appointmentDetailInclude,
      orderBy: [
        { rosterEntry: { date: 'asc' } },
        { rosterEntry: { shift: { startTime: 'asc' } } },
        { queueNumber: 'asc' },
      ],
    });
    return withDoctorLoad(rows, prisma);
  }

  /** Appointments matching the staff filters, in date → shift → doctor → queue order. */
  async findForStaff(filter: StaffAppointmentFilter): Promise<AppointmentRecord[]> {
    const rows = await prisma.appointment.findMany({
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
    return withDoctorLoad(rows, prisma);
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

  /** Every appointment of one roster entry, in queue order (UC-D2). */
  async findByRosterEntry(rosterEntryId: number): Promise<AppointmentRecord[]> {
    const rows = await prisma.appointment.findMany({
      where: { rosterEntryId },
      include: appointmentDetailInclude,
      orderBy: { queueNumber: 'asc' },
    });
    return withDoctorLoad(rows, prisma);
  }

  /** The waiting (CHECKED_IN) appointment with the lowest queue number (UC-D3), if any. */
  findFirstCheckedIn(rosterEntryId: number) {
    return prisma.appointment.findFirst({
      where: { rosterEntryId, status: AppointmentStatus.CHECKED_IN },
      orderBy: { queueNumber: 'asc' },
      select: { id: true },
    });
  }

  /** The doctor's patient currently IN_EXAMINATION on `date` (in any of their shifts), if any. */
  findDoctorInExamination(doctorUserId: number, date: string) {
    return prisma.appointment.findFirst({
      where: {
        status: AppointmentStatus.IN_EXAMINATION,
        rosterEntry: { date, doctor: { userId: doctorUserId } },
      },
      select: {
        id: true,
        queueNumber: true,
        patient: { select: { fullName: true } },
        rosterEntry: { select: { id: true, shift: true } },
      },
    });
  }

  /**
   * Appointments from `fromDate` on that are still open (BOOKED, CHECKED_IN, IN_EXAMINATION)
   * for a doctor, a room or a specialty — used to block deactivating them (UC-A1..A3).
   */
  countUpcomingOpen(
    owner: { doctorId?: number; roomId?: number; specialtyId?: number },
    fromDate: string,
  ): Promise<number> {
    return prisma.appointment.count({
      where: {
        status: {
          in: [
            AppointmentStatus.BOOKED,
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.IN_EXAMINATION,
          ],
        },
        rosterEntry: {
          date: { gte: fromDate },
          doctorId: owner.doctorId,
          roomId: owner.roomId,
          doctor: owner.specialtyId ? { specialtyId: owner.specialtyId } : undefined,
        },
      },
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

  async create(data: NewAppointment, db: Db = prisma): Promise<AppointmentRecord> {
    const row = await db.appointment.create({ data, include: appointmentDetailInclude });
    return (await withDoctorLoad([row], db))[0];
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
