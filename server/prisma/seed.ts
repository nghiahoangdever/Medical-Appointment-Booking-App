// Demo data: staff accounts, specialties, rooms, shifts, a two-week roster, patients and a
// few bookings. Idempotent — wipes all tables first, so it is safe to re-run.
// Display content (names, descriptions) is Vietnamese; codes and enum values stay English.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateAppointmentCode } from '../src/domain/booking';
import { AppointmentStatus, Gender, Role } from '../src/domain/enums';
import { addDays, startOfWeek, today } from '../src/domain/time';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

const SPECIALTIES = [
  {
    name: 'Nội tổng quát',
    description: 'Khám và điều trị các bệnh nội khoa thường gặp ở người lớn.',
  },
  {
    name: 'Nhi khoa',
    description: 'Chăm sóc sức khỏe cho trẻ sơ sinh, trẻ em và thanh thiếu niên.',
  },
  { name: 'Da liễu', description: 'Các bệnh về da, tóc và móng.' },
];

const ROOMS = [
  { code: 'A1-01', name: 'Phòng khám A1-01', floor: '1' },
  { code: 'A1-02', name: 'Phòng khám A1-02', floor: '1' },
  { code: 'A1-03', name: 'Phòng khám A1-03', floor: '1' },
  { code: 'B2-01', name: 'Phòng khám B2-01', floor: '2' },
  { code: 'B2-02', name: 'Phòng khám B2-02', floor: '2' },
  { code: 'B2-03', name: 'Phòng khám B2-03', floor: '2' },
  // Free rooms (no fixed doctor): one usable, one deactivated, for the admin screens.
  { code: 'B2-04', name: 'Phòng khám B2-04', floor: '2' },
  { code: 'C3-01', name: 'Phòng khám C3-01 (đang sửa chữa)', floor: '3', isActive: false },
];

// Shift names are fixed identifiers; the client shows them as "Ca sáng" / "Ca chiều".
const SHIFTS = [
  { name: 'Morning', startTime: '07:30', endTime: '11:30' },
  { name: 'Afternoon', startTime: '13:00', endTime: '17:00' },
];

// Two doctors per specialty, listed in SPECIALTIES order.
const DOCTORS = [
  { fullName: 'Trần Thị Linh', title: 'BS.CKI', specialty: 'Nội tổng quát' },
  { fullName: 'Phạm Minh Đức', title: 'PGS.TS.BS', specialty: 'Nội tổng quát' },
  { fullName: 'Nguyễn Thị Mai', title: 'ThS.BS', specialty: 'Nhi khoa' },
  { fullName: 'Lê Quang Huy', title: 'BS.CKII', specialty: 'Nhi khoa' },
  { fullName: 'Võ Thị Thu', title: 'ThS.BS', specialty: 'Da liễu' },
  { fullName: 'Đặng Văn Khoa', title: 'BS.CKI', specialty: 'Da liễu' },
];

const PATIENTS = [
  {
    fullName: 'Hoàng Văn An',
    dateOfBirth: '1990-04-12',
    gender: Gender.MALE,
    address: '12 Lê Lợi, Quận 1',
  },
  {
    fullName: 'Ngô Thị Bích',
    dateOfBirth: '1985-11-03',
    gender: Gender.FEMALE,
    address: '45 Trần Hưng Đạo, Quận 5',
  },
  { fullName: 'Đỗ Minh Châu', dateOfBirth: '2015-06-21', gender: Gender.OTHER },
];

async function clearDatabase() {
  // Children before parents (foreign keys).
  await prisma.appointmentNote.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.rosterEntry.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.room.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.specialty.deleteMany();
  // Restart ids at 1 so demo data is predictable.
  await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence');
}

async function main() {
  await clearDatabase();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let phoneSeq = 1;
  const nextPhone = () => `09000000${String(phoneSeq++).padStart(2, '0')}`;

  // Staff
  await prisma.user.create({
    data: {
      fullName: 'Quản trị viên',
      email: 'admin@medischedule.local',
      phone: nextPhone(),
      passwordHash,
      role: Role.ADMIN,
    },
  });
  for (const n of [1, 2]) {
    await prisma.user.create({
      data: {
        fullName: `Lễ tân ${n}`,
        email: `reception${n}@medischedule.local`,
        phone: nextPhone(),
        passwordHash,
        role: Role.RECEPTIONIST,
      },
    });
  }

  // Specialties, rooms, shifts
  const specialties = new Map<string, number>();
  for (const s of SPECIALTIES) {
    specialties.set(s.name, (await prisma.specialty.create({ data: s })).id);
  }
  const rooms = [];
  for (const r of ROOMS) rooms.push(await prisma.room.create({ data: r }));
  const morning = await prisma.shift.create({ data: SHIFTS[0] });
  const afternoon = await prisma.shift.create({ data: SHIFTS[1] });

  // Doctors
  const doctors = [];
  for (const [i, d] of DOCTORS.entries()) {
    doctors.push(
      await prisma.doctor.create({
        data: {
          title: d.title,
          bio: `Bác sĩ chuyên khoa ${d.specialty}.`,
          specialty: { connect: { id: specialties.get(d.specialty)! } },
          user: {
            create: {
              fullName: d.fullName,
              email: `doctor${i + 1}@medischedule.local`,
              phone: nextPhone(),
              passwordHash,
              role: Role.DOCTOR,
            },
          },
        },
      }),
    );
  }

  // Roster for this week and next (Mon–Sat). Each doctor keeps one room.
  // In each specialty pair: both doctors work mornings (so auto-assign has a choice);
  // afternoons alternate (first doctor Mon/Wed/Fri, second Tue/Thu); Sat morning is the second doctor only.
  const monday = startOfWeek(today());
  let rosterCount = 0;
  for (let day = 0; day < 14; day++) {
    const weekday = day % 7; // 0 = Mon
    if (weekday === 6) continue; // closed on Sunday
    const date = addDays(monday, day);
    for (const [i, doctor] of doctors.entries()) {
      const isFirstOfPair = i % 2 === 0;
      const shifts = [];
      if (weekday <= 4 || !isFirstOfPair) shifts.push({ shift: morning, maxPatients: 10 });
      if (weekday <= 4 && (isFirstOfPair ? weekday % 2 === 0 : weekday % 2 === 1)) {
        shifts.push({ shift: afternoon, maxPatients: 6 });
      }
      for (const { shift, maxPatients } of shifts) {
        await prisma.rosterEntry.create({
          data: { doctorId: doctor.id, roomId: rooms[i].id, shiftId: shift.id, date, maxPatients },
        });
        rosterCount++;
      }
    }
  }

  // Patients
  const patients = [];
  for (const [i, p] of PATIENTS.entries()) {
    patients.push(
      await prisma.user.create({
        data: {
          fullName: p.fullName,
          email: `patient${i + 1}@example.com`,
          phone: nextPhone(),
          passwordHash,
          role: Role.PATIENT,
          patientProfile: {
            create: { dateOfBirth: p.dateOfBirth, gender: p.gender, address: p.address },
          },
        },
      }),
    );
  }

  // A few bookings in the first doctor's next morning shift after today.
  const demoEntry = await prisma.rosterEntry.findFirst({
    where: { doctorId: doctors[0].id, shiftId: morning.id, date: { gt: today() } },
    orderBy: { date: 'asc' },
  });
  const bookings = [
    { patient: patients[0], reason: 'Đau đầu, chóng mặt kéo dài 3 ngày' },
    { patient: patients[1], reason: 'Khám sức khỏe định kỳ' },
  ];
  if (demoEntry) {
    for (const [i, { patient, reason }] of bookings.entries()) {
      await prisma.appointment.create({
        data: {
          code: generateAppointmentCode(),
          patientId: patient.id,
          rosterEntryId: demoEntry.id,
          queueNumber: i + 1,
          status: AppointmentStatus.BOOKED,
          reason,
        },
      });
    }
    await prisma.rosterEntry.update({
      where: { id: demoEntry.id },
      data: { nextQueueNumber: bookings.length + 1 },
    });
  }

  console.log(
    `Seeded 1 admin, 2 receptionists, ${DOCTORS.length} doctors, ${PATIENTS.length} patients, ` +
      `${SPECIALTIES.length} specialties, ${ROOMS.length} rooms, ${SHIFTS.length} shifts, ` +
      `${rosterCount} roster entries (weeks of ${monday} and ${addDays(monday, 7)}), ` +
      `${demoEntry ? bookings.length : 0} appointments. Password for every account: ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
