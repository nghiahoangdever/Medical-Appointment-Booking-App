// AppointmentService reception features against the test database, with fixed clocks.
// Appointments are booked at 06:00 on 20/10/2026 for that day's Morning (07:30–11:30)
// and Afternoon (13:00–17:00) shifts.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../src/domain/enums';
import { appointmentRepository } from '../src/modules/appointments/appointment.repository';
import { AppointmentService } from '../src/modules/appointments/appointment.service';
import { BookingService } from '../src/modules/appointments/booking.service';
import { noteRepository } from '../src/modules/appointments/note.repository';
import { rosterRepository } from '../src/modules/roster/roster.repository';
import { shiftRepository } from '../src/modules/shifts/shift.repository';
import { prisma, resetDatabase } from './helpers/db';
import { addRoster, createClinic, createPatient, createStaff } from './helpers/fixtures';

const TODAY = '2026-10-20';
const at =
  (hours: number, minutes = 0) =>
  () =>
    new Date(2026, 9, 20, hours, minutes);
const serviceAt = (hours: number, minutes = 0) =>
  new AppointmentService(appointmentRepository, noteRepository, at(hours, minutes));
const booking = new BookingService(rosterRepository, appointmentRepository, shiftRepository, at(6));

let clinic: Awaited<ReturnType<typeof createClinic>>;
let receptionist: { id: number; role: Role };

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
  const { doctorA, doctorB, roomA, roomB, morning, afternoon } = clinic;
  await addRoster({
    doctorId: doctorA.id,
    roomId: roomA.id,
    shiftId: morning.id,
    date: TODAY,
    maxPatients: 5,
  });
  await addRoster({
    doctorId: doctorB.id,
    roomId: roomB.id,
    shiftId: morning.id,
    date: TODAY,
    maxPatients: 5,
  });
  await addRoster({
    doctorId: doctorA.id,
    roomId: roomA.id,
    shiftId: afternoon.id,
    date: TODAY,
    maxPatients: 5,
  });
  const user = await createStaff(Role.RECEPTIONIST);
  receptionist = { id: user.id, role: Role.RECEPTIONIST };
});
afterAll(() => prisma.$disconnect());

async function bookToday(shift: 'morning' | 'afternoon', doctorId?: number) {
  const patient = await createPatient();
  return booking.book(patient.id, {
    specialtyId: clinic.specialty.id,
    date: TODAY,
    shiftId: clinic[shift].id,
    doctorId,
  });
}

describe('checkIn', () => {
  it('BOOKED â†’ CHECKED_IN during the shift, stamping checkedInAt', async () => {
    const appt = await bookToday('morning');
    const result = await serviceAt(9).checkIn(receptionist, appt.id);
    expect(result).toMatchObject({ status: 'CHECKED_IN', checkedInAt: at(9)() });
  });

  it('is rejected after the shift ends', async () => {
    const appt = await bookToday('morning');
    await expect(serviceAt(11, 30).checkIn(receptionist, appt.id)).rejects.toMatchObject({
      status: 409,
      code: 'CHECK_IN_SHIFT_ENDED',
    });
  });

  it('is rejected on a different day', async () => {
    const appt = await bookToday('afternoon');
    const nextDay = new AppointmentService(
      appointmentRepository,
      noteRepository,
      () => new Date(2026, 9, 21, 8, 0),
    );
    await expect(nextDay.checkIn(receptionist, appt.id)).rejects.toMatchObject({
      code: 'CHECK_IN_NOT_TODAY',
    });
  });

  it('cannot check in twice (INVALID_STATUS_TRANSITION)', async () => {
    const appt = await bookToday('morning');
    await serviceAt(9).checkIn(receptionist, appt.id);
    await expect(serviceAt(9).checkIn(receptionist, appt.id)).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
  });

  it('is only for receptionists (ACTION_NOT_ALLOWED_FOR_ROLE)', async () => {
    const appt = await bookToday('morning');
    const admin = { id: (await createStaff(Role.ADMIN)).id, role: Role.ADMIN };
    await expect(serviceAt(9).checkIn(admin, appt.id)).rejects.toMatchObject({
      status: 403,
      code: 'ACTION_NOT_ALLOWED_FOR_ROLE',
    });
  });
});

describe('markNoShow', () => {
  it('is rejected before the shift starts', async () => {
    const appt = await bookToday('afternoon');
    await expect(serviceAt(9).markNoShow(receptionist, appt.id)).rejects.toMatchObject({
      code: 'NO_SHOW_TOO_EARLY',
    });
  });

  it('BOOKED â†’ NO_SHOW once the shift has started; the place stays used', async () => {
    const appt = await bookToday('morning', clinic.doctorA.id);
    const result = await serviceAt(9).markNoShow(receptionist, appt.id);
    expect(result.status).toBe('NO_SHOW');
    expect(result.allowedActions).toEqual([]);

    const [slot] = await rosterRepository.findSlots({
      specialtyId: clinic.specialty.id,
      doctorId: clinic.doctorA.id,
      shiftId: clinic.morning.id,
      dateFrom: TODAY,
      dateTo: TODAY,
    });
    expect(slot.activeCount).toBe(1);
  });

  it('cannot mark a checked-in patient as no-show from reception', async () => {
    const appt = await bookToday('morning');
    await serviceAt(9).checkIn(receptionist, appt.id);
    await expect(serviceAt(9).markNoShow(receptionist, appt.id)).rejects.toMatchObject({
      code: 'ACTION_NOT_ALLOWED_FOR_ROLE',
    });
  });
});

describe('staff cancel', () => {
  it('works after the shift has started and records who cancelled', async () => {
    const appt = await bookToday('morning');
    const result = await serviceAt(10).cancel(receptionist, appt.id, 'Bệnh nhân gọi báo hủy');
    expect(result).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Bệnh nhân gọi báo hủy',
    });
    const row = await prisma.appointment.findUnique({ where: { id: appt.id } });
    expect(row?.cancelledById).toBe(receptionist.id);
  });
});

describe('addNote', () => {
  it('adds notes in order with author, returned in the staff view', async () => {
    const appt = await bookToday('morning');
    await serviceAt(8).addNote(receptionist, appt.id, 'Bệnh nhân đến sớm');
    const result = await serviceAt(9).addNote(receptionist, appt.id, 'Đã đo huyết áp');
    expect(result.notes.map((n) => n.content)).toEqual(['Bệnh nhân đến sớm', 'Đã đo huyết áp']);
    expect(result.notes[0].author.role).toBe('RECEPTIONIST');
  });

  it('returns 404 for an unknown appointment', async () => {
    await expect(serviceAt(9).addNote(receptionist, 9999, 'x')).rejects.toMatchObject({
      code: 'APPOINTMENT_NOT_FOUND',
    });
  });
});

describe('listForStaff', () => {
  it('lists a day in shift â†’ doctor â†’ queue order with patient details and per-status counts', async () => {
    const a1 = await bookToday('morning', clinic.doctorA.id);
    await bookToday('morning', clinic.doctorA.id);
    await bookToday('morning', clinic.doctorB.id);
    await bookToday('afternoon');
    await serviceAt(9).checkIn(receptionist, a1.id);

    const { appointments, counts } = await serviceAt(9).listForStaff(receptionist, { date: TODAY });
    expect(appointments.map((a) => [a.shift.startTime, a.doctor.id, a.queueNumber])).toEqual([
      ['07:30', clinic.doctorA.id, 1],
      ['07:30', clinic.doctorA.id, 2],
      ['07:30', clinic.doctorB.id, 1],
      ['13:00', clinic.doctorA.id, 1],
    ]);
    expect(appointments[0].patient).toMatchObject({ dateOfBirth: '1990-01-01', gender: 'FEMALE' });
    expect(counts).toMatchObject({ BOOKED: 3, CHECKED_IN: 1, CANCELLED: 0 });
  });

  it('filters by shift, doctor and status (counts ignore the status filter)', async () => {
    const a1 = await bookToday('morning', clinic.doctorA.id);
    await bookToday('morning', clinic.doctorB.id);
    await bookToday('afternoon');
    await serviceAt(9).checkIn(receptionist, a1.id);
    const svc = serviceAt(9);

    const byShift = await svc.listForStaff(receptionist, {
      date: TODAY,
      shiftId: clinic.afternoon.id,
    });
    expect(byShift.appointments).toHaveLength(1);

    const byDoctor = await svc.listForStaff(receptionist, {
      date: TODAY,
      doctorId: clinic.doctorB.id,
    });
    expect(byDoctor.appointments.map((a) => a.doctor.id)).toEqual([clinic.doctorB.id]);

    const byStatus = await svc.listForStaff(receptionist, { date: TODAY, status: 'CHECKED_IN' });
    expect(byStatus.appointments.map((a) => a.id)).toEqual([a1.id]);
    expect(byStatus.counts).toMatchObject({ BOOKED: 2, CHECKED_IN: 1 });
  });

  it('searches by part of the code (any case) or the phone, across dates', async () => {
    const appt = await bookToday('morning');
    const svc = serviceAt(9);
    const patient = await prisma.user.findUniqueOrThrow({
      where: {
        id: (await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).patientId,
      },
    });

    const byCode = await svc.listForStaff(receptionist, {
      query: appt.code.slice(3).toLowerCase(),
    });
    expect(byCode.appointments.map((a) => a.id)).toEqual([appt.id]);

    const byPhone = await svc.listForStaff(receptionist, { query: patient.phone.slice(-6) });
    expect(byPhone.appointments.map((a) => a.id)).toEqual([appt.id]);

    const none = await svc.listForStaff(receptionist, { query: 'ZZZZZZ' });
    expect(none.appointments).toEqual([]);
  });

  it('gives each appointment the actions reception can take right now', async () => {
    await bookToday('morning');
    await bookToday('afternoon');
    const { appointments } = await serviceAt(9).listForStaff(receptionist, { date: TODAY });
    expect(appointments.map((a) => a.allowedActions)).toEqual([
      ['CANCEL', 'CHECK_IN', 'MARK_NO_SHOW'], // morning: in progress
      ['CANCEL', 'CHECK_IN'], // afternoon: not started yet
    ]);
  });
});
