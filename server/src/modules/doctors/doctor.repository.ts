import { prisma } from '../../db/prisma';

export interface DoctorSummary {
  id: number;
  fullName: string;
  title: string;
  bio: string | null;
  specialtyId: number;
}

const doctorWithName = { user: { select: { fullName: true } } } as const;

export class DoctorRepository {
  /** Doctors whose accounts are active, in one specialty. */
  async findActiveBySpecialty(specialtyId: number): Promise<DoctorSummary[]> {
    const doctors = await prisma.doctor.findMany({
      where: { specialtyId, user: { isActive: true } },
      include: doctorWithName,
      orderBy: { id: 'asc' },
    });
    return doctors.map(toSummary);
  }

  async findActiveById(id: number): Promise<DoctorSummary | null> {
    const doctor = await prisma.doctor.findFirst({
      where: { id, user: { isActive: true } },
      include: doctorWithName,
    });
    return doctor && toSummary(doctor);
  }
}

function toSummary(d: {
  id: number;
  title: string;
  bio: string | null;
  specialtyId: number;
  user: { fullName: string };
}): DoctorSummary {
  return {
    id: d.id,
    fullName: d.user.fullName,
    title: d.title,
    bio: d.bio,
    specialtyId: d.specialtyId,
  };
}

export const doctorRepository = new DoctorRepository();
