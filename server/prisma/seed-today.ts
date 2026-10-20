// DEV ONLY — fills TODAY with reception test data, whatever the weekday.
//
//   npm run db:seed:today -w server
//
// Ensures Morning + Afternoon roster entries today for doctor1 (Nội tổng quát, A1-01) and
// doctor3 (Nhi khoa, A1-03), deletes their existing appointments for today, then books and
// moves appointments through the real services with simulated clocks (booked at 06:00,
// checked in at 07:15, …), so every status change goes through the state machine.
// doctor3's morning ends up mid-shift (one completed, one in examination, one waiting);
// doctor1 has a waiting patient in the morning and one checked in early for the afternoon.
// Combine with DEV_FAKE_NOW in server/.env to test time rules at any hour (see CLAUDE.md).
// Requires the main seed (npm run db:seed -w server) to have run first.

import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma';
import { Gender, Role } from '../src/domain/enums';
import type { Clock } from '../src/domain/time';
import { today } from '../src/domain/time';
import { appointmentRepository } from '../src/modules/appointments/appointment.repository';
import { AppointmentService } from '../src/modules/appointments/appointment.service';
import { BookingService } from '../src/modules/appointments/booking.service';
import { noteRepository } from '../src/modules/appointments/note.repository';
import { rosterRepository } from '../src/modules/roster/roster.repository';
import { shiftRepository } from '../src/modules/shifts/shift.repository';

if (process.env.NODE_ENV === 'production') {
  throw new Error('seed-today is for development only');
}

const DATE = today();

/** A clock fixed at hh:mm today. */
const at =
  (hours: number, minutes = 0): Clock =>
  () => {
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

const booking = new BookingService(rosterRepository, appointmentRepository, shiftRepository, at(6));
const serviceAt = (hours: number, minutes = 0) =>
  new AppointmentService(appointmentRepository, noteRepository, at(hours, minutes));

const EXTRA_PATIENTS = [
  {
    email: 'patient4@example.com',
    fullName: 'Trịnh Văn Dũng',
    phone: '0911000004',
    dateOfBirth: '1978-08-30',
    gender: Gender.MALE,
  },
  {
    email: 'patient5@example.com',
    fullName: 'Phan Thị Hoa',
    phone: '0911000005',
    dateOfBirth: '1996-01-17',
    gender: Gender.FEMALE,
  },
  {
    email: 'patient6@example.com',
    fullName: 'Bùi Gia Huy',
    phone: '0911000006',
    dateOfBirth: '2019-05-09',
    gender: Gender.MALE,
  },
  {
    email: 'patient7@example.com',
    fullName: 'Lý Thanh Tâm',
    phone: '0911000007',
    dateOfBirth: '2017-11-02',
    gender: Gender.FEMALE,
  },
  {
    email: 'patient8@example.com',
    fullName: 'Hồ Minh Khang',
    phone: '0911000008',
    dateOfBirth: '2020-03-14',
    gender: Gender.MALE,
  },
];

async function findDoctor(email: string, roomCode: string) {
  const doctor = await prisma.doctor.findFirstOrThrow({ where: { user: { email } } });
  const room = await prisma.room.findUniqueOrThrow({ where: { code: roomCode } });
  return { ...doctor, roomId: room.id };
}

async function main() {
  const morning = await prisma.shift.findUniqueOrThrow({ where: { name: 'Morning' } });
  const afternoon = await prisma.shift.findUniqueOrThrow({ where: { name: 'Afternoon' } });
  const internal = await findDoctor('doctor1@medischedule.local', 'A1-01');
  const pediatric = await findDoctor('doctor3@medischedule.local', 'A1-03');
  const receptionistUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'reception1@medischedule.local' },
  });
  const reception = { id: receptionistUser.id, role: Role.RECEPTIONIST };
  const pediatricDoctor = { id: pediatric.userId, role: Role.DOCTOR };

  // Roster entries for today (kept if the main seed already created them).
  for (const doctor of [internal, pediatric]) {
    for (const [shift, maxPatients] of [
      [morning, 10],
      [afternoon, 6],
    ] as const) {
      const entry = await prisma.rosterEntry.upsert({
        where: { doctorId_date_shiftId: { doctorId: doctor.id, date: DATE, shiftId: shift.id } },
        create: {
          doctorId: doctor.id,
          roomId: doctor.roomId,
          shiftId: shift.id,
          date: DATE,
          maxPatients,
        },
        update: {},
      });
      // Start today's queue for these entries from scratch.
      await prisma.appointmentNote.deleteMany({
        where: { appointment: { rosterEntryId: entry.id } },
      });
      await prisma.appointment.deleteMany({ where: { rosterEntryId: entry.id } });
      await prisma.rosterEntry.update({ where: { id: entry.id }, data: { nextQueueNumber: 1 } });
    }
  }

  // Patients 1–3 come from the main seed; 4–8 are created here if missing.
  const passwordHash = await bcrypt.hash('password123', 10);
  for (const { dateOfBirth, gender, ...user } of EXTRA_PATIENTS) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        ...user,
        passwordHash,
        role: Role.PATIENT,
        patientProfile: { create: { dateOfBirth, gender } },
      },
      update: {},
    });
  }
  const patients = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      prisma.user.findUniqueOrThrow({ where: { email: `patient${n}@example.com` } }),
    ),
  );
  const [p1, p2, p3, p4, p5, p6, p7, p8] = patients;

  const book = (
    patient: { id: number },
    doctor: { id: number; specialtyId: number },
    shiftId: number,
    reason?: string,
  ) =>
    booking.book(patient.id, {
      specialtyId: doctor.specialtyId,
      doctorId: doctor.id,
      date: DATE,
      shiftId,
      reason,
    });

  // Morning — Nội tổng quát
  await book(p1, internal, morning.id, 'Đau đầu, chóng mặt kéo dài 3 ngày');
  const m2 = await book(p2, internal, morning.id, 'Tái khám tăng huyết áp');
  await serviceAt(7, 15).checkIn(reception, m2.id);
  await serviceAt(7, 16).addNote(reception, m2.id, 'Bệnh nhân mang theo kết quả xét nghiệm cũ.');
  await book(p3, internal, morning.id, 'Ho, sốt nhẹ');
  const m4 = await book(p4, internal, morning.id, 'Đau dạ dày');
  await serviceAt(6, 30).cancel({ id: p4.id, role: Role.PATIENT }, m4.id, 'Bận việc đột xuất');
  await book(p5, internal, morning.id, 'Khám sức khỏe định kỳ');

  // Morning — Nhi khoa (doctor3 is mid-shift: one done, one in examination, one waiting)
  const n1 = await book(p6, pediatric, morning.id, 'Sốt 38.5°C, biếng ăn');
  await serviceAt(7, 20).checkIn(reception, n1.id);
  await book(p4, pediatric, morning.id, 'Khám cho con: phát ban');
  const n3 = await book(p7, pediatric, morning.id, 'Ho có đờm 1 tuần');
  await serviceAt(7, 25).checkIn(reception, n3.id);
  const n4 = await book(p8, pediatric, morning.id, 'Đau bụng, nôn');
  await serviceAt(7, 30).checkIn(reception, n4.id);
  await serviceAt(7, 40).start(pediatricDoctor, n1.id);
  await serviceAt(7, 50).addNote(
    pediatricDoctor,
    n1.id,
    'Viêm họng cấp. Kê hạ sốt, tái khám sau 3 ngày.',
  );
  await serviceAt(7, 55).complete(pediatricDoctor, n1.id);
  await serviceAt(7, 56).start(pediatricDoctor, n3.id);

  // Afternoon — Nội tổng quát (one patient already waiting before the shift starts)
  await book(p1, internal, afternoon.id, 'Lấy kết quả xét nghiệm máu');
  const a2 = await book(p2, internal, afternoon.id);
  await serviceAt(12, 45).checkIn(reception, a2.id);

  // Afternoon — Nhi khoa
  const a3 = await book(p3, pediatric, afternoon.id, 'Tiêm nhắc lại');
  await serviceAt(12, 30).checkIn(reception, a3.id);
  await book(p5, pediatric, afternoon.id, 'Viêm họng');

  const counts = await prisma.appointment.groupBy({
    by: ['status'],
    where: { rosterEntry: { date: DATE } },
    _count: { _all: true },
  });
  console.log(
    `Seeded today's (${DATE}) reception and doctor scenarios: ` +
      counts.map((c) => `${c.status} ${c._count._all}`).join(', ') +
      '.\nUse DEV_FAKE_NOW in server/.env (e.g. "06:00", "09:00", "12:00", "18:00") to test time rules.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
