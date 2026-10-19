import { prisma } from '../../db/prisma';

export class ShiftRepository {
  findById(id: number) {
    return prisma.shift.findUnique({ where: { id } });
  }
}

export const shiftRepository = new ShiftRepository();
