import { prisma, type Db } from '../../db/prisma';
import { Role } from '../../domain/enums';

export interface DoctorSummary {
  id: number;
  fullName: string;
  title: string;
  bio: string | null;
  specialtyId: number;
}

const doctorWithName = { user: { select: { fullName: true } } } as const;

/** Doctor + account + specialty, as the admin screens need them. */
const doctorAccountInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } },
  specialty: { select: { id: true, name: true, isActive: true } },
} as const;

export interface NewDoctorAccount {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  specialtyId: number;
  title: string;
  bio: string | null;
}

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

  // Admin (UC-A3)

  /** Every doctor with account and specialty, active or not. */
  findAllAccounts() {
    return prisma.doctor.findMany({
      include: doctorAccountInclude,
      orderBy: [{ specialty: { name: 'asc' } }, { id: 'asc' }],
    });
  }

  findAccountById(id: number, db: Db = prisma) {
    return db.doctor.findUnique({ where: { id }, include: doctorAccountInclude });
  }

  /** Creates the User (role DOCTOR) and the Doctor profile together. */
  createAccount({ specialtyId, title, bio, ...user }: NewDoctorAccount) {
    return prisma.doctor.create({
      data: {
        title,
        bio,
        specialty: { connect: { id: specialtyId } },
        user: { create: { ...user, role: Role.DOCTOR } },
      },
      include: doctorAccountInclude,
    });
  }

  /** Updates the doctor profile; account fields go through UserRepository. */
  updateProfile(id: number, data: { title?: string; bio?: string | null }) {
    return prisma.doctor.update({ where: { id }, data, include: doctorAccountInclude });
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
