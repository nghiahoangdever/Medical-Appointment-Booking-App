import { prisma } from '../../db/prisma';
import { Role, type Gender } from '../../domain/enums';

export interface CreatePatientData {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  profile: { dateOfBirth: string; gender: Gender; address?: string };
}

export class UserRepository {
  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  }

  /** Login accepts either an email or a phone number. */
  findByEmailOrPhone(identifier: string) {
    return prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
  }

  /** Any user already using this email or this phone. */
  findConflicting(email: string, phone: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
  }

  createPatient({ profile, ...user }: CreatePatientData) {
    return prisma.user.create({
      data: { ...user, role: Role.PATIENT, patientProfile: { create: profile } },
    });
  }
}

export const userRepository = new UserRepository();
