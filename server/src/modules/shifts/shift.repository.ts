import { prisma, type Db } from '../../db/prisma';

export class ShiftRepository {
  findById(id: number, db: Db = prisma) {
    return db.shift.findUnique({ where: { id } });
  }

  findAll() {
    return prisma.shift.findMany({ orderBy: { startTime: 'asc' } });
  }

  /** UC-A5: shift names are fixed; only the times change. */
  updateTimes(id: number, times: { startTime: string; endTime: string }) {
    return prisma.shift.update({ where: { id }, data: times });
  }
}

export const shiftRepository = new ShiftRepository();
