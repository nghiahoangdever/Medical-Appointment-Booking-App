import { prisma } from '../../db/prisma';
import { Role, type Gender } from '../../domain/enums';

export interface CreatePatientData {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  profile: { dateOfBirth: string; gender: Gender; address?: string };
}

export interface AccountUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  isActive?: boolean;
}

const accountSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
} as const;

export class UserRepository {
  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  }

  /** Login accepts either an email or a phone number. */
  findByEmailOrPhone(identifier: string) {
    return prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
  }

  /** Any user (other than `exceptUserId`) already using this email or this phone. */
  findConflicting(email: string, phone: string, exceptUserId?: number) {
    return prisma.user.findFirst({
      where: { OR: [{ email }, { phone }], id: exceptUserId ? { not: exceptUserId } : undefined },
      select: { email: true, phone: true },
    });
  }

  createPatient({ profile, ...user }: CreatePatientData) {
    return prisma.user.create({
      data: { ...user, role: Role.PATIENT, patientProfile: { create: profile } },
    });
  }

  // Admin (UC-A4): receptionist accounts

  findAccountsByRole(role: Role) {
    return prisma.user.findMany({ where: { role }, select: accountSelect, orderBy: { id: 'asc' } });
  }

  findAccountById(id: number) {
    return prisma.user.findUnique({ where: { id }, select: accountSelect });
  }

  createAccount(data: {
    fullName: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: Role;
  }) {
    return prisma.user.create({ data, select: accountSelect });
  }

  updateAccount(id: number, data: AccountUpdate) {
    return prisma.user.update({ where: { id }, data, select: accountSelect });
  }
}

export const userRepository = new UserRepository();
