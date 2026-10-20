// RosterService (UC-A6 / UC-A7) against the test database. "Now" is Tue 20/10/2026 09:00,
// so this week is 19/10–25/10 (19/10 is already past) and next week starts 26/10.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '../src/domain/enums';
import { appointmentRepository } from '../src/modules/appointments/appointment.repository';
import { AppointmentService } from '../src/modules/appointments/appointment.service';
import { BookingService } from '../src/modules/appointments/booking.service';
import { noteRepository } from '../src/modules/appointments/note.repository';
import { doctorRepository } from '../src/modules/doctors/doctor.repository';
import { roomRepository } from '../src/modules/rooms/room.repository';
import { rosterRepository } from '../src/modules/roster/roster.repository';
import { RosterService } from '../src/modules/roster/roster.service';
import { shiftRepository } from '../src/modules/shifts/shift.repository';
import { prisma, resetDatabase } from './helpers/db';
import { addRoster, createClinic, createPatient } from './helpers/fixtures';

const NOW = new Date(2026, 9, 20, 9, 0);
const clock = () => NOW;
const roster = new RosterService(
  rosterRepository,
  doctorRepository,
  roomRepository,
  shiftRepository,
  clock,
);
const booking = new BookingService(rosterRepository, appointmentRepository, shiftRepository, clock);
const appointments = new AppointmentService(appointmentRepository, noteRepository, clock);

let clinic: Awaited<ReturnType<typeof createClinic>>;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
});
afterAll(() => prisma.$disconnect());

const entryInput = (overrides: Partial<Parameters<typeof roster.createEntry>[0]> = {}) => ({
  doctorId: clinic.doctorA.id,
  roomId: clinic.roomA.id,
  shiftId: clinic.morning.id,
  date: '2026-10-21',
  maxPatients: 5,
  ...overrides,
});

async function bookOn(entry: { date: string; shiftId: number; doctorId: number }, count: number) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const patient = await createPatient();
    const appt = await booking.book(patient.id, {
      specialtyId: clinic.specialty.id,
      doctorId: entry.doctorId,
      date: entry.date,
      shiftId: entry.shiftId,
    });
    ids.push({ appointmentId: appt.id, patientId: patient.id });
  }
  return ids;
}

describe('createEntry', () => {
  it('creates an entry and reports what the editor may do with it', async () => {
    const entry = await roster.createEntry(entryInput());
    expect(entry).toMatchObject({
      date: '2026-10-21',
      roomId: clinic.roomA.id,
      maxPatients: 5,
      activeCount: 0,
      editable: true,
      deletable: true,
      doctor: { id: clinic.doctorA.id, specialty: { id: clinic.specialty.id } },
    });
  });

  it('rejects a doctor who is already on duty in that slot (any room)', async () => {
    await roster.createEntry(entryInput());
    await expect(roster.createEntry(entryInput({ roomId: clinic.roomB.id }))).rejects.toMatchObject(
      {
        status: 409,
        code: 'ROSTER_DOCTOR_CONFLICT',
      },
    );
  });

  it('rejects a room that is already taken in that slot', async () => {
    await roster.createEntry(entryInput());
    await expect(
      roster.createEntry(entryInput({ doctorId: clinic.doctorB.id })),
    ).rejects.toMatchObject({ code: 'ROSTER_ROOM_CONFLICT' });
  });

  it('allows the same doctor and room in a different shift or date', async () => {
    await roster.createEntry(entryInput());
    await expect(
      roster.createEntry(entryInput({ shiftId: clinic.afternoon.id })),
    ).resolves.toBeDefined();
    await expect(roster.createEntry(entryInput({ date: '2026-10-22' }))).resolves.toBeDefined();
  });

  it('rejects past dates, inactive doctors/rooms and unknown shifts', async () => {
    await expect(roster.createEntry(entryInput({ date: '2026-10-19' }))).rejects.toMatchObject({
      code: 'ROSTER_DATE_IN_PAST',
    });
    await prisma.user.update({ where: { id: clinic.doctorA.userId }, data: { isActive: false } });
    await expect(roster.createEntry(entryInput())).rejects.toMatchObject({
      code: 'DOCTOR_INACTIVE',
    });
    await prisma.room.update({ where: { id: clinic.roomB.id }, data: { isActive: false } });
    await expect(
      roster.createEntry(entryInput({ doctorId: clinic.doctorB.id, roomId: clinic.roomB.id })),
    ).rejects.toMatchObject({ code: 'ROOM_INACTIVE' });
    await expect(
      roster.createEntry(entryInput({ doctorId: clinic.doctorB.id, shiftId: 9999 })),
    ).rejects.toMatchObject({ code: 'SHIFT_NOT_FOUND' });
  });
});

describe('updateEntry', () => {
  it('cannot lower capacity below the active bookings (cancelled ones free their place)', async () => {
    const entry = await roster.createEntry(entryInput());
    const booked = await bookOn(entryInput(), 3);
    await appointments.cancel(
      { id: booked[2].patientId, role: Role.PATIENT },
      booked[2].appointmentId,
    );

    await expect(roster.updateEntry(entry.id, { maxPatients: 1 })).rejects.toMatchObject({
      code: 'ROSTER_CAPACITY_BELOW_BOOKED',
    });
    const updated = await roster.updateEntry(entry.id, { maxPatients: 2 });
    expect(updated).toMatchObject({ maxPatients: 2, activeCount: 2, minMaxPatients: 2 });
  });

  it('moves an entry to a free active room only', async () => {
    const entry = await roster.createEntry(entryInput());
    await roster.createEntry(entryInput({ doctorId: clinic.doctorB.id, roomId: clinic.roomB.id }));
    await expect(roster.updateEntry(entry.id, { roomId: clinic.roomB.id })).rejects.toMatchObject({
      code: 'ROSTER_ROOM_CONFLICT',
    });
    const roomC = await prisma.room.create({ data: { code: 'R-C', name: 'Phòng C' } });
    expect((await roster.updateEntry(entry.id, { roomId: roomC.id })).roomId).toBe(roomC.id);
  });

  it('refuses to change past entries', async () => {
    const past = await addRoster({ ...entryInput({ date: '2026-10-19' }) });
    await expect(roster.updateEntry(past.id, { maxPatients: 9 })).rejects.toMatchObject({
      code: 'ROSTER_DATE_IN_PAST',
    });
  });
});

describe('deleteEntry', () => {
  it('deletes an entry nobody booked', async () => {
    const entry = await roster.createEntry(entryInput());
    await roster.deleteEntry(entry.id);
    expect(await prisma.rosterEntry.count()).toBe(0);
  });

  it('refuses when there are bookings, even cancelled ones', async () => {
    const entry = await roster.createEntry(entryInput());
    const [only] = await bookOn(entryInput(), 1);
    await appointments.cancel({ id: only.patientId, role: Role.PATIENT }, only.appointmentId);
    await expect(roster.deleteEntry(entry.id)).rejects.toMatchObject({
      code: 'ROSTER_HAS_APPOINTMENTS',
    });
  });
});

describe('copyPreviousWeek', () => {
  it('copies last week into the target week and skips what cannot be placed', async () => {
    const source = [
      entryInput({ date: '2026-10-21' }), // → 28/10 ok
      entryInput({ date: '2026-10-22', doctorId: clinic.doctorB.id, roomId: clinic.roomB.id }), // → 29/10 doctor B inactive
      entryInput({ date: '2026-10-23', shiftId: clinic.afternoon.id, maxPatients: 7 }), // → 30/10 doctor A already there
    ];
    for (const e of source) await roster.createEntry(e);
    await prisma.user.update({ where: { id: clinic.doctorB.userId }, data: { isActive: false } });
    const roomC = await prisma.room.create({ data: { code: 'R-C', name: 'Phòng C' } });
    await roster.createEntry(
      entryInput({ date: '2026-10-30', shiftId: clinic.afternoon.id, roomId: roomC.id }),
    );

    const result = await roster.copyPreviousWeek('2026-10-26');
    expect(result.sourceWeekStart).toBe('2026-10-19');
    expect(result.created).toBe(1);
    expect(result.skipped.map((s) => [s.date, s.reason])).toEqual([
      ['2026-10-29', 'DOCTOR_INACTIVE'],
      ['2026-10-30', 'ROSTER_DOCTOR_CONFLICT'],
    ]);
    const copied = await prisma.rosterEntry.findFirst({ where: { date: '2026-10-28' } });
    expect(copied).toMatchObject({
      doctorId: clinic.doctorA.id,
      roomId: clinic.roomA.id,
      maxPatients: 5,
    });
  });

  it('skips target days that are already past', async () => {
    await addRoster(entryInput({ date: '2026-10-12' })); // Mon of the previous week → 19/10 (past)
    await addRoster(entryInput({ date: '2026-10-14' })); // Wed → 21/10
    const result = await roster.copyPreviousWeek('2026-10-19');
    expect(result.created).toBe(1);
    expect(result.skipped).toEqual([
      expect.objectContaining({ date: '2026-10-19', reason: 'ROSTER_DATE_IN_PAST' }),
    ]);
  });

  it('is repeatable: copying twice creates nothing new', async () => {
    await roster.createEntry(entryInput());
    await roster.copyPreviousWeek('2026-10-26');
    const again = await roster.copyPreviousWeek('2026-10-26');
    expect(again.created).toBe(0);
    expect(again.skipped[0].reason).toBe('ROSTER_DOCTOR_CONFLICT');
  });
});

describe('getWeek', () => {
  it('returns 7 days, active doctors, and active rooms plus inactive ones used that week', async () => {
    await roster.createEntry(entryInput());
    await prisma.room.update({ where: { id: clinic.roomA.id }, data: { isActive: false } });
    const unusedInactive = await prisma.room.create({
      data: { code: 'R-X', name: 'Phòng X', isActive: false },
    });
    await prisma.user.update({ where: { id: clinic.doctorB.userId }, data: { isActive: false } });

    const week = await roster.getWeek('2026-10-19');
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toEqual({ date: '2026-10-19', editable: false }); // Monday is past
    expect(week.days[1]).toEqual({ date: '2026-10-20', editable: true }); // today
    expect(week.days[6]).toEqual({ date: '2026-10-25', editable: true });
    const roomIds = week.rooms.map((r) => r.id);
    expect(roomIds).toContain(clinic.roomA.id);
    expect(roomIds).not.toContain(unusedInactive.id);
    expect(week.doctors.map((d) => d.id)).toEqual([clinic.doctorA.id]);
    expect(week.entries).toHaveLength(1);
  });
});
