import { prisma } from '../../db/prisma';

export class SpecialtyRepository {
  findAllActive() {
    return prisma.specialty.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  findActiveById(id: number) {
    return prisma.specialty.findFirst({ where: { id, isActive: true } });
  }
}

export const specialtyRepository = new SpecialtyRepository();
