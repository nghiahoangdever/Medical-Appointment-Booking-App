// BookingService and AppointmentService.cancel against the test database, with a fixed clock:
// "now" is Tuesday 20/10/2026 09:00, so today's morning shift (07:30) has started
// and today's afternoon shift (13:00) has not.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../src/domain/enums';
import { AppointmentService } from '../src/modules/appointments/appointment.service';
import { appointmentRepository } from '../src/modules/appointments/appointment.repository';
import { BookingService, type BookingRequest } from '../src/modules/appointments/booking.service';
import { rosterRepository } from '../src/modules/roster/roster.repository';
import { shiftRepository } from '../src/modules/shifts/shift.repository';
import { prisma, resetDatabase } from './helpers/db';
import { addRoster, createClinic, createPatient, createStaff } from './helpers/fixtures';

const TODAY = '2026-10-20';
const TOMORROW = '2026-10-21';
const NOW = new Date(2026, 9, 20, 9, 0);

const clockAt = (date: Date) => () => date;
const booking = new BookingService(
  rosterRepository,
  appointmentRepository,
  shiftRepository,
  clockAt(NOW),
);
const appointments = new AppointmentService(appointmentRepository, clockAt(NOW));

let clinic: Awaited<ReturnType<typeof createClinic>>;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
});
afterAll(() => prisma.$disconnect());

/** Tomorrow-morning roster for both doctors. */
async function rosterTomorrowMorning(maxA = 5, maxB = 5) {
  const { doctorA, doctorB, roomA, roomB, morning } = clinic;
  await addRoster({
    doctorId: doctorA.id,
    roomId: roomA.id,
    shiftId: morning.id,
    date: TOMORROW,
    maxPatients: maxA,
  });
  await addRoster({
    doctorId: doctorB.id,
    roomId: roomB.id,
    shiftId: morning.id,
    date: TOMORROW,
    maxPatients: maxB,
  });
}

function request(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    specialtyId: clinic.specialty.id,
    date: TOMORROW,
    shiftId: clinic.morning.id,
    ...overrides,
  };
}

describe('BookingService.book', () => {
  it('assigns the least-booked doctor when none is chosen (tie → lower id)', async () => {
    await rosterTomorrowMorning();
    const assigned = [];
    for (let i = 0; i < 3; i++) {
      const patient = await createPatient();
      assigned.push((await booking.book(patient.id, request())).doctor.id);
    }
    const { doctorA, doctorB } = clinic;
    expect(assigned).toEqual([doctorA.id, doctorB.id, doctorA.id]);
  });

  it('books the chosen doctor even if another has fewer bookings', async () => {
    await rosterTomorrowMorning();
    const first = await booking.book((await createPatient()).id, request());
    const second = await booking.book(
      (await createPatient()).id,
      request({ doctorId: clinic.doctorA.id }),
    );
    expect(first.doctor.id).toBe(clinic.doctorA.id);
    expect(second.doctor.id).toBe(clinic.doctorA.id);
    expect(second.queueNumber).toBe(2);
  });

  it('returns the full appointment with code, queue number, room and shift', async () => {
    await rosterTomorrowMorning();
    const result = await booking.book(
      (await createPatient()).id,
      request({ reason: 'Ho kéo dài' }),
    );
    expect(result).toMatchObject({
      status: 'BOOKED',
      queueNumber: 1,
      date: TOMORROW,
      reason: 'Ho kéo dài',
      shift: { startTime: '07:30', endTime: '11:30' },
      room: { id: clinic.roomA.id },
      specialty: { id: clinic.specialty.id },
    });
    expect(result.code).toMatch(/^AP-[A-Z2-9]{6}$/);
  });

  it('never reuses a queue number after a cancellation, but frees the place', async () => {
    await rosterTomorrowMorning(2, 0);
    const p1 = await createPatient();
    const p2 = await createPatient();
    const p3 = await createPatient();
    await booking.book(p1.id, request());
    const second = await booking.book(p2.id, request());
    await expect(booking.book(p3.id, request())).rejects.toMatchObject({ code: 'SHIFT_FULL' });

    await appointments.cancel({ id: p2.id, role: Role.PATIENT }, second.id);
    const third = await booking.book(p3.id, request());
    expect(third.queueNumber).toBe(3);
  });

  it('rejects with SHIFT_FULL when every doctor on duty is full', async () => {
    await rosterTomorrowMorning(1, 1);
    await booking.book((await createPatient()).id, request());
    await booking.book((await createPatient()).id, request());
    await expect(booking.book((await createPatient()).id, request())).rejects.toMatchObject({
      status: 409,
      code: 'SHIFT_FULL',
    });
  });

  it('rejects a second active appointment in the same shift (DUPLICATE_BOOKING)', async () => {
    await rosterTomorrowMorning();
    const patient = await createPatient();
    await booking.book(patient.id, request({ doctorId: clinic.doctorA.id }));
    await expect(
      booking.book(patient.id, request({ doctorId: clinic.doctorB.id })),
    ).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_BOOKING' });
  });

  it('allows rebooking the same shift after cancelling', async () => {
    await rosterTomorrowMorning();
    const patient = await createPatient();
    const first = await booking.book(patient.id, request());
    await appointments.cancel({ id: patient.id, role: Role.PATIENT }, first.id);
    await expect(booking.book(patient.id, request())).resolves.toMatchObject({ status: 'BOOKED' });
  });

  it('enforces the booking window and shift start time', async () => {
    const { doctorA, roomA, morning, afternoon } = clinic;
    await addRoster({
      doctorId: doctorA.id,
      roomId: roomA.id,
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
    const patient = await createPatient();

    await expect(booking.book(patient.id, request({ date: '2026-10-19' }))).rejects.toMatchObject({
      code: 'DATE_IN_PAST',
    });
    await expect(booking.book(patient.id, request({ date: '2026-11-03' }))).rejects.toMatchObject({
      code: 'DATE_OUTSIDE_BOOKING_WINDOW',
    });
    await expect(booking.book(patient.id, request({ date: TODAY }))).rejects.toMatchObject({
      code: 'SHIFT_ALREADY_STARTED',
    });
    await expect(
      booking.book(patient.id, request({ date: TODAY, shiftId: afternoon.id })),
    ).resolves.toMatchObject({ status: 'BOOKED' });
  });

  it('rejects when nobody matching is on duty (NO_DOCTOR_ON_DUTY)', async () => {
    await rosterTomorrowMorning();
    const patient = await createPatient();
    await expect(
      booking.book(patient.id, request({ shiftId: clinic.afternoon.id })),
    ).rejects.toMatchObject({ code: 'NO_DOCTOR_ON_DUTY' });
    await expect(
      booking.book(patient.id, request({ specialtyId: clinic.otherSpecialty.id })),
    ).rejects.toMatchObject({ code: 'NO_DOCTOR_ON_DUTY' });
  });

  it('never overbooks or repeats a queue number under concurrent requests', async () => {
    await rosterTomorrowMorning(3, 0);
    const patients = await Promise.all(Array.from({ length: 6 }, () => createPatient()));
    const results = await Promise.allSettled(patients.map((p) => booking.book(p.id, request())));

    const booked = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const rejected = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
    expect(booked.map((a) => a.queueNumber).sort()).toEqual([1, 2, 3]);
    expect(rejected).toHaveLength(3);
    for (const err of rejected) expect(err).toMatchObject({ code: 'SHIFT_FULL' });
  });
});

describe('AppointmentService.cancel', () => {
  it('lets a patient cancel their own appointment before the shift starts', async () => {
    await rosterTomorrowMorning();
    const patient = await createPatient();
    const appt = await booking.book(patient.id, request());

    const cancelled = await appointments.cancel(
      { id: patient.id, role: Role.PATIENT },
      appt.id,
      'Bận việc',
    );
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Bận việc' });
    expect(cancelled.cancelledAt).toEqual(NOW);
  });

  it("hides other patients' appointments (APPOINTMENT_NOT_FOUND)", async () => {
    await rosterTomorrowMorning();
    const owner = await createPatient();
    const other = await createPatient();
    const appt = await booking.book(owner.id, request());
    await expect(
      appointments.cancel({ id: other.id, role: Role.PATIENT }, appt.id),
    ).rejects.toMatchObject({ status: 404, code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('stops patients cancelling once the shift has started, but not reception', async () => {
    const { doctorA, roomA, morning } = clinic;
    await addRoster({
      doctorId: doctorA.id,
      roomId: roomA.id,
      shiftId: morning.id,
      date: TODAY,
      maxPatients: 5,
    });
    const earlyBooking = new BookingService(
      rosterRepository,
      appointmentRepository,
      shiftRepository,
      clockAt(new Date(2026, 9, 20, 7, 0)),
    );
    const patient = await createPatient();
    const appt = await earlyBooking.book(patient.id, request({ date: TODAY }));

    await expect(
      appointments.cancel({ id: patient.id, role: Role.PATIENT }, appt.id),
    ).rejects.toMatchObject({ code: 'CANCEL_DEADLINE_PASSED' });

    const receptionist = await createStaff(Role.RECEPTIONIST);
    await expect(
      appointments.cancel({ id: receptionist.id, role: Role.RECEPTIONIST }, appt.id),
    ).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('cannot cancel twice (INVALID_STATUS_TRANSITION)', async () => {
    await rosterTomorrowMorning();
    const patient = await createPatient();
    const appt = await booking.book(patient.id, request());
    const actor = { id: patient.id, role: Role.PATIENT };
    await appointments.cancel(actor, appt.id);
    await expect(appointments.cancel(actor, appt.id)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATUS_TRANSITION',
    });
  });
});
