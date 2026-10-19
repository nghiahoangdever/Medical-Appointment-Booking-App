import { prisma } from '../../src/db/prisma';

/** Empties every table (children first) so each test starts clean. */
export async function resetDatabase() {
  await prisma.appointmentNote.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.rosterEntry.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.room.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.specialty.deleteMany();
}

export { prisma };
