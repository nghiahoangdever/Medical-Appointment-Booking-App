import { Role } from '../../src/domain/enums';
import { signToken } from '../../src/modules/auth/token';
import { prisma } from './db';

let seq = 0;
const unique = () => ++seq;

export async function createPatient(fullName = 'Bệnh nhân') {
  const n = unique();
  return prisma.user.create({
    data: {
      fullName: `${fullName} ${n}`,
      email: `patient${n}@test.local`,
      phone: `0910${String(n).padStart(6, '0')}`,
      passwordHash: 'not-used',
      role: Role.PATIENT,
      patientProfile: { create: { dateOfBirth: '1990-01-01', gender: 'FEMALE' } },
    },
  });
}

export async function createStaff(role: Role) {
  const n = unique();
  return prisma.user.create({
    data: {
      fullName: `${role} ${n}`,
      email: `staff${n}@test.local`,
      phone: `0920${String(n).padStart(6, '0')}`,
      passwordHash: 'not-used',
      role,
    },
  });
}

export async function createDoctor(specialtyId: number) {
  const user = await createStaff(Role.DOCTOR);
  return prisma.doctor.create({
    data: { userId: user.id, specialtyId, title: 'BS' },
    include: { user: true },
  });
}

/** A small clinic: one specialty with doctors A and B (A has the lower id), rooms, two shifts. */
export async function createClinic() {
  const specialty = await prisma.specialty.create({ data: { name: `Nội tổng quát ${unique()}` } });
  const otherSpecialty = await prisma.specialty.create({ data: { name: `Da liễu ${unique()}` } });
  const morning = await prisma.shift.create({
    data: { name: `Morning ${unique()}`, startTime: '07:30', endTime: '11:30' },
  });
  const afternoon = await prisma.shift.create({
    data: { name: `Afternoon ${unique()}`, startTime: '13:00', endTime: '17:00' },
  });
  const roomA = await prisma.room.create({ data: { code: `R-${unique()}`, name: 'Phòng A' } });
  const roomB = await prisma.room.create({ data: { code: `R-${unique()}`, name: 'Phòng B' } });
  const doctorA = await createDoctor(specialty.id);
  const doctorB = await createDoctor(specialty.id);
  return { specialty, otherSpecialty, morning, afternoon, roomA, roomB, doctorA, doctorB };
}

export function addRoster(data: {
  doctorId: number;
  roomId: number;
  shiftId: number;
  date: string;
  maxPatients: number;
}) {
  return prisma.rosterEntry.create({ data });
}

export function bearer(user: { id: number; role: string }) {
  return `Bearer ${signToken({ userId: user.id, role: user.role as Role })}`;
}
