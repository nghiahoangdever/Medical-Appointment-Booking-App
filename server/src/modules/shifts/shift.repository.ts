import { prisma } from '../../db/prisma';

export class ShiftRepository {
  findById(id: number) {
    return prisma.shift.findUnique({ where: { id } });
  }

  findAll() {
    return prisma.shift.findMany({ orderBy: { startTime: 'asc' } });
  }
}

export const shiftRepository = new ShiftRepository();
