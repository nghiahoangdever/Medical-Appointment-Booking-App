// Doctor queue (Phase 4) against the test database with fixed clocks.
// Today is 20/10/2026. Patients book at 06:00, reception checks in at 07:00, the doctor works at 09:00.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../src/domain/enums';
import type { Actor } from '../src/domain/appointmentRules';
import { appointmentRepository } from '../src/modules/appointments/appointment.repository';
import { AppointmentService } from '../src/modules/appointments/appointment.service';
import { BookingService } from '../src/modules/appointments/booking.service';
import { noteRepository } from '../src/modules/appointments/note.repository';
import { QueueService } from '../src/modules/queue/queue.service';
import { rosterRepository } from '../src/modules/roster/roster.repository';
import { shiftRepository } from '../src/modules/shifts/shift.repository';
import { prisma, resetDatabase } from './helpers/db';
import { addRoster, createClinic, createPatient, createStaff } from './helpers/fixtures';

const TODAY = '2026-10-20';
const at =
  (hours: number, minutes = 0, day = 20) =>
  () =>
    new Date(2026, 9, day, hours, minutes);
const servicesAt = (clock: () => Date) => {
  const appointments = new AppointmentService(appointmentRepository, noteRepository, clock);
  return {
    appointments,
    queue: new QueueService(rosterRepository, appointmentRepository, appointments, clock),
  };
};
const booking = new BookingService(rosterRepository, appointmentRepository, shiftRepository, at(6));
const { appointments: reception7 } = servicesAt(at(7));
const { appointments: svc9, queue: queue9 } = servicesAt(at(9));

let clinic: Awaited<ReturnType<typeof createClinic>>;
let doctorA: Actor;
let doctorB: Actor;
let receptionist: Actor;
let entryId: number;
/** Appointment ids by queue number 1..4 in doctor A's morning queue. */
let q: Record<number, number>;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
  doctorA = { id: clinic.doctorA.userId, role: Role.DOCTOR };
  doctorB = { id: clinic.doctorB.userId, role: Role.DOCTOR };
  receptionist = { id: (await createStaff(Role.RECEPTIONIST)).id, role: Role.RECEPTIONIST };

  const entry = await addRoster({
    doctorId: clinic.doctorA.id,
    roomId: clinic.roomA.id,
    shiftId: clinic.morning.id,
    date: TODAY,
    maxPatients: 10,
  });
  entryId = entry.id;
  q = {};
  for (let n = 1; n <= 4; n++) {
    const patient = await createPatient();
    const appt = await booking.book(patient.id, {
      specialtyId: clinic.specialty.id,
      doctorId: clinic.doctorA.id,
      date: TODAY,
      shiftId: clinic.morning.id,
    });
    q[appt.queueNumber] = appt.id;
  }
  // #1 hasn't arrived; #2, #3, #4 are waiting.
  for (const n of [2, 3, 4]) await reception7.checkIn(receptionist, q[n]);
});
afterAll(() => prisma.$disconnect());

describe('getQueue', () => {
  it('lists the shift in queue order with the doctor’s actions and who is next', async () => {
    const result = await queue9.getQueue(doctorA, entryId);
    expect(result.entry).toMatchObject({ id: entryId, date: TODAY, maxPatients: 10 });
    expect(result.entry.counts).toMatchObject({ BOOKED: 1, CHECKED_IN: 3, IN_EXAMINATION: 0 });
    expect(result.appointments.map((a) => [a.queueNumber, a.status, a.allowedActions])).toEqual([
      [1, 'BOOKED', ['MARK_NO_SHOW']],
      [2, 'CHECKED_IN', ['START', 'MARK_NO_SHOW']],
      [3, 'CHECKED_IN', ['START', 'MARK_NO_SHOW']],
      [4, 'CHECKED_IN', ['START', 'MARK_NO_SHOW']],
    ]);
    expect(result.nextAppointmentId).toBe(q[2]); // #1 not arrived → #2 is next
    expect(result.appointments[0].patient).toBeDefined(); // staff view
  });

  it("hides another doctor's queue", async () => {
    await expect(queue9.getQueue(doctorB, entryId)).rejects.toMatchObject({
      status: 404,
      code: 'ROSTER_ENTRY_NOT_FOUND',
    });
  });
});

describe('callNext / complete', () => {
  it('starts the lowest waiting number, then blocks until it is completed', async () => {
    const first = await queue9.callNext(doctorA, entryId);
    expect(first).toMatchObject({ id: q[2], status: 'IN_EXAMINATION', startedAt: at(9)() });

    await expect(queue9.callNext(doctorA, entryId)).rejects.toMatchObject({
      status: 409,
      code: 'DOCTOR_BUSY',
    });
    const busy = await queue9.getQueue(doctorA, entryId);
    expect(busy.nextAppointmentId).toBeNull();
    expect(busy.appointments.find((a) => a.id === q[3])?.allowedActions).toEqual(['MARK_NO_SHOW']);

    const done = await svc9.complete(doctorA, q[2]);
    expect(done).toMatchObject({ status: 'COMPLETED', completedAt: at(9)() });

    const second = await queue9.callNext(doctorA, entryId);
    expect(second.id).toBe(q[3]);
  });

  it('reports NO_PATIENT_WAITING when nobody is checked in', async () => {
    for (const n of [2, 3, 4]) await svc9.markNoShow(doctorA, q[n]);
    await expect(queue9.callNext(doctorA, entryId)).rejects.toMatchObject({
      code: 'NO_PATIENT_WAITING',
    });
  });

  it('lets the doctor start a specific waiting patient out of order', async () => {
    const result = await svc9.start(doctorA, q[4]);
    expect(result.status).toBe('IN_EXAMINATION');
    await expect(svc9.start(doctorA, q[3])).rejects.toMatchObject({ code: 'DOCTOR_BUSY' });
  });

  it('never has two patients in examination, even with concurrent requests', async () => {
    const results = await Promise.allSettled([
      svc9.start(doctorA, q[2]),
      svc9.start(doctorA, q[3]),
      queue9.callNext(doctorA, entryId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const inExam = await prisma.appointment.count({
      where: { rosterEntryId: entryId, status: 'IN_EXAMINATION' },
    });
    expect(inExam).toBe(1);
  });

  it('cannot complete a patient who is only checked in', async () => {
    await expect(svc9.complete(doctorA, q[2])).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    });
  });

  it('cannot start on another day', async () => {
    const { appointments: nextDay } = servicesAt(at(9, 0, 21));
    await expect(nextDay.start(doctorA, q[2])).rejects.toMatchObject({ code: 'EXAM_NOT_TODAY' });
  });
});

describe('one patient at a time per doctor, across shifts', () => {
  /** A same-day afternoon roster entry with one checked-in patient. */
  async function afternoonWaiting(doctor = clinic.doctorA, room = clinic.roomA) {
    const entry = await addRoster({
      doctorId: doctor.id,
      roomId: room.id,
      shiftId: clinic.afternoon.id,
      date: TODAY,
      maxPatients: 6,
    });
    const patient = await createPatient();
    const appt = await booking.book(patient.id, {
      specialtyId: clinic.specialty.id,
      doctorId: doctor.id,
      date: TODAY,
      shiftId: clinic.afternoon.id,
    });
    await reception7.checkIn(receptionist, appt.id);
    return { entryId: entry.id, appointmentId: appt.id };
  }

  it('blocks the afternoon queue while a morning patient is in examination', async () => {
    const afternoon = await afternoonWaiting();
    await queue9.callNext(doctorA, entryId); // morning #2 is now in examination

    await expect(svc9.start(doctorA, afternoon.appointmentId)).rejects.toMatchObject({
      code: 'DOCTOR_BUSY',
    });
    await expect(queue9.callNext(doctorA, afternoon.entryId)).rejects.toMatchObject({
      code: 'DOCTOR_BUSY',
    });

    const queue = await queue9.getQueue(doctorA, afternoon.entryId);
    expect(queue.nextAppointmentId).toBeNull();
    expect(queue.appointments[0].allowedActions).not.toContain('START');
    expect(queue.inExaminationElsewhere).toMatchObject({
      appointmentId: q[2],
      rosterEntryId: entryId,
      queueNumber: 2,
      shift: { startTime: '07:30' },
    });

    await svc9.complete(doctorA, q[2]);
    const freed = await queue9.getQueue(doctorA, afternoon.entryId);
    expect(freed.nextAppointmentId).toBe(afternoon.appointmentId);
    expect(freed.inExaminationElsewhere).toBeNull();
  });

  it('reports nothing "elsewhere" when the open exam is in this same shift', async () => {
    await queue9.callNext(doctorA, entryId);
    expect((await queue9.getQueue(doctorA, entryId)).inExaminationElsewhere).toBeNull();
  });

  it('does not block a different doctor', async () => {
    const other = await afternoonWaiting(clinic.doctorB, clinic.roomB);
    await queue9.callNext(doctorA, entryId);
    await expect(svc9.start(doctorB, other.appointmentId)).resolves.toMatchObject({
      status: 'IN_EXAMINATION',
    });
  });

  it('holds under concurrent starts in two different shifts', async () => {
    const afternoon = await afternoonWaiting();
    const results = await Promise.allSettled([
      svc9.start(doctorA, q[2]),
      svc9.start(doctorA, afternoon.appointmentId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const inExam = await prisma.appointment.count({
      where: { status: 'IN_EXAMINATION', rosterEntry: { doctorId: clinic.doctorA.id } },
    });
    expect(inExam).toBe(1);
  });
});

describe('doctor no-show and ownership', () => {
  it('marks a checked-in or a booked patient as no-show after the shift starts', async () => {
    expect((await svc9.markNoShow(doctorA, q[3])).status).toBe('NO_SHOW');
    expect((await svc9.markNoShow(doctorA, q[1])).status).toBe('NO_SHOW');
  });

  it('rejects no-show before the shift starts', async () => {
    const { appointments: early } = servicesAt(at(7, 15));
    await expect(early.markNoShow(doctorA, q[2])).rejects.toMatchObject({
      code: 'NO_SHOW_TOO_EARLY',
    });
  });

  it("hides another doctor's appointments for actions and notes (404)", async () => {
    for (const action of [
      () => svc9.start(doctorB, q[2]),
      () => svc9.markNoShow(doctorB, q[2]),
      () => svc9.addNote(doctorB, q[2], 'x'),
    ]) {
      await expect(action()).rejects.toMatchObject({ status: 404, code: 'APPOINTMENT_NOT_FOUND' });
    }
  });

  it('lets the doctor add notes to their own patients', async () => {
    const result = await svc9.addNote(doctorA, q[2], 'Huyết áp 140/90');
    expect(result.notes.at(-1)).toMatchObject({
      content: 'Huyết áp 140/90',
      author: { role: 'DOCTOR' },
    });
  });
});

describe('getSchedule', () => {
  it("lists only this doctor's shifts from today through the booking window, with counts", async () => {
    await addRoster({
      doctorId: clinic.doctorA.id,
      roomId: clinic.roomA.id,
      shiftId: clinic.afternoon.id,
      date: '2026-10-22',
      maxPatients: 6,
    });
    await addRoster({
      doctorId: clinic.doctorA.id,
      roomId: clinic.roomA.id,
      shiftId: clinic.morning.id,
      date: '2026-10-19', // yesterday: not listed
      maxPatients: 6,
    });
    await addRoster({
      doctorId: clinic.doctorB.id,
      roomId: clinic.roomB.id,
      shiftId: clinic.morning.id,
      date: TODAY, // other doctor: not listed
      maxPatients: 6,
    });

    const shifts = await queue9.getSchedule(doctorA);
    expect(shifts.map((s) => [s.date, s.shift.startTime])).toEqual([
      [TODAY, '07:30'],
      ['2026-10-22', '13:00'],
    ]);
    expect(shifts[0].counts).toMatchObject({ BOOKED: 1, CHECKED_IN: 3 });
    expect(shifts[0]).toMatchObject({
      room: { id: clinic.roomA.id },
      specialty: { id: clinic.specialty.id },
    });
  });
});
