import { prisma } from '../../db/prisma';

export interface SpecialtyData {
  name: string;
  description: string | null;
}

export class SpecialtyRepository {
  findAllActive() {
    return prisma.specialty.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  findActiveById(id: number) {
    return prisma.specialty.findFirst({ where: { id, isActive: true } });
  }

  // Admin (UC-A1)

  /** Every specialty, active or not, with how many active doctors it has. */
  findAllWithDoctorCounts() {
    return prisma.specialty.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { doctors: { where: { user: { isActive: true } } } } } },
    });
  }

  findById(id: number) {
    return prisma.specialty.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return prisma.specialty.findUnique({ where: { name } });
  }

  create(data: SpecialtyData) {
    return prisma.specialty.create({ data });
  }

  update(id: number, data: Partial<SpecialtyData> & { isActive?: boolean }) {
    return prisma.specialty.update({ where: { id }, data });
  }
}

export const specialtyRepository = new SpecialtyRepository();
