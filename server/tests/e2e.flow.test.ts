// End-to-end API flow: one clinic day across all four roles, driven only through HTTP with real
// logins (the same calls the client makes). The system clock is faked (Date only, timers stay
// real) so the time rules — booking before the shift, check-in on the day, no-show after the
// shift starts — run at fixed moments. Steps share state and run in order.

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { Role } from '../src/domain/enums';
import { hashPassword } from '../src/modules/users/password';
import { prisma, resetDatabase } from './helpers/db';

const app = createApp();
const PASSWORD = 'password123';

// Sunday evening the roster is set up and patients book; Monday is the clinic day.
const SUNDAY_EVENING = new Date(2026, 10, 1, 18, 0);
const MONDAY = '2026-11-02';
const NEXT_MONDAY = '2026-11-09';
const at = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return new Date(2026, 10, 2, h, m);
};

/** Requests carrying one user's Bearer token. */
function as(token: string) {
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (path: string) => auth(request(app).get(path)),
    post: (path: string, body?: object) => auth(request(app).post(path)).send(body ?? {}),
    patch: (path: string, body: object) => auth(request(app).patch(path)).send(body),
    delete: (path: string) => auth(request(app).delete(path)),
  };
}

async function login(identifier: string, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

async function register(n: number) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      fullName: `Bệnh nhân ${n}`,
      email: `benhnhan${n}@example.com`,
      phone: `09120000${String(n).padStart(2, '0')}`,
      password: PASSWORD,
      dateOfBirth: '1990-05-0' + n,
      gender: 'FEMALE',
    });
  expect(res.status).toBe(201);
  const { email, phone } = res.body.user as { email: string; phone: string };
  return { api: as(res.body.token), email, phone };
}

// Shared state, filled in step by step.
let admin: ReturnType<typeof as>;
let reception: ReturnType<typeof as>;
let doctor: ReturnType<typeof as>;
const patients: {
  api: ReturnType<typeof as>;
  email: string;
  phone: string;
  appointmentId?: number;
}[] = [];
let ids: { specialty: number; room: number; doctor: number; morning: number; entry: number };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SUNDAY_EVENING);
  await resetDatabase();
  // Fixed clinic data that the admin UI cannot create: the shifts and the first admin account.
  await prisma.shift.createMany({
    data: [
      { name: 'Morning', startTime: '07:30', endTime: '11:30' },
      { name: 'Afternoon', startTime: '13:00', endTime: '17:00' },
    ],
  });
  await prisma.user.create({
    data: {
      fullName: 'Quản trị viên',
      email: 'admin@clinic.local',
      phone: '0900000000',
      passwordHash: await hashPassword(PASSWORD),
      role: Role.ADMIN,
    },
  });
});

afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe('a full clinic day across all four roles', () => {
  it('admin sets up a specialty, room, staff accounts and the roster (UC-A1..A6)', async () => {
    admin = as(await login('admin@clinic.local'));

    const specialty = await admin.post('/api/admin/specialties', { name: 'Tim mạch' });
    expect(specialty.status).toBe(201);
    const room = await admin.post('/api/admin/rooms', { code: 'A1-01', name: 'Phòng A1-01' });
    expect(room.status).toBe(201);
    const doc = await admin.post('/api/admin/doctors', {
      fullName: 'Nguyễn Văn Tâm',
      title: 'BS.CKI',
      specialtyId: specialty.body.specialty.id,
      email: 'bs.tam@clinic.local',
      phone: '0900000001',
      password: PASSWORD,
    });
    expect(doc.status).toBe(201);
    const receptionist = await admin.post('/api/admin/receptionists', {
      fullName: 'Trần Thị Lan',
      email: 'letan@clinic.local',
      phone: '0900000002',
      password: PASSWORD,
    });
    expect(receptionist.status).toBe(201);

    const shifts = await admin.get('/api/shifts');
    const morning = shifts.body.shifts.find((s: { name: string }) => s.name === 'Morning');
    const entry = await admin.post('/api/admin/roster-entries', {
      doctorId: doc.body.doctor.id,
      roomId: room.body.room.id,
      shiftId: morning.id,
      date: MONDAY,
      maxPatients: 2,
    });
    expect(entry.status).toBe(201);
    ids = {
      specialty: specialty.body.specialty.id,
      room: room.body.room.id,
      doctor: doc.body.doctor.id,
      morning: morning.id,
      entry: entry.body.entry.id,
    };

    reception = as(await login('letan@clinic.local'));
    doctor = as(await login('0900000001')); // phone works as the login identifier too
  });

  it('patients register, see availability and book; capacity and duplicates are enforced (UC-P1..P4)', async () => {
    for (const n of [1, 2, 3]) patients.push(await register(n));
    const [p1, p2, p3] = patients;

    const availability = await p1.api.get(`/api/availability?specialtyId=${ids.specialty}`);
    const monday = availability.body.days.find((d: { date: string }) => d.date === MONDAY);
    expect(monday.shifts).toEqual([
      expect.objectContaining({ shiftId: ids.morning, status: 'AVAILABLE', remainingSlots: 2 }),
    ]);

    const book = (p: (typeof patients)[number]) =>
      p.api.post('/api/appointments', {
        specialtyId: ids.specialty,
        date: MONDAY,
        shiftId: ids.morning,
        reason: 'Đau ngực',
      });

    const first = await book(p1);
    expect(first.status).toBe(201);
    expect(first.body.appointment).toMatchObject({
      queueNumber: 1,
      status: 'BOOKED',
      code: expect.stringMatching(/^AP-/),
      doctor: { fullName: 'Nguyễn Văn Tâm' }, // assigned automatically
      allowedActions: ['CANCEL'],
    });
    p1.appointmentId = first.body.appointment.id;

    expect((await book(p1)).body.error.code).toBe('DUPLICATE_BOOKING');

    const second = await book(p2);
    expect(second.body.appointment.queueNumber).toBe(2);
    p2.appointmentId = second.body.appointment.id;

    const full = await book(p3);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('SHIFT_FULL');
  });

  it('a cancellation frees the place but its queue number is never reused (UC-P7)', async () => {
    const [, p2, p3] = patients;
    const cancelled = await p2.api.post(`/api/appointments/${p2.appointmentId}/cancel`);
    expect(cancelled.body.appointment.status).toBe('CANCELLED');

    const booked = await p3.api.post('/api/appointments', {
      specialtyId: ids.specialty,
      date: MONDAY,
      shiftId: ids.morning,
    });
    expect(booked.body.appointment.queueNumber).toBe(3);
    p3.appointmentId = booked.body.appointment.id;
  });

  it('admin raises capacity but cannot go below the booked places (UC-A6)', async () => {
    const tooLow = await admin.patch(`/api/admin/roster-entries/${ids.entry}`, { maxPatients: 1 });
    expect(tooLow.body.error.code).toBe('ROSTER_CAPACITY_BELOW_BOOKED');
    const raised = await admin.patch(`/api/admin/roster-entries/${ids.entry}`, { maxPatients: 3 });
    expect(raised.body.entry).toMatchObject({ maxPatients: 3, activeCount: 2 });

    const p4 = await register(4);
    patients.push(p4);
    const booked = await p4.api.post('/api/appointments', {
      specialtyId: ids.specialty,
      date: MONDAY,
      shiftId: ids.morning,
    });
    expect(booked.body.appointment.queueNumber).toBe(4);
    patients[3].appointmentId = booked.body.appointment.id;
  });

  it("Sunday's tokens have expired by Monday morning, so everyone logs in again", async () => {
    vi.setSystemTime(at('07:00'));
    const stale = await reception.get(`/api/appointments?date=${MONDAY}`);
    expect(stale.body.error.code).toBe('INVALID_TOKEN'); // 8 h JWT issued at 18:00

    admin = as(await login('admin@clinic.local'));
    reception = as(await login('letan@clinic.local'));
    doctor = as(await login('bs.tam@clinic.local'));
    for (const p of patients) p.api = as(await login(p.email));
  });

  it('on the day, reception lists, searches, checks in and adds notes (UC-R1..R3, R7)', async () => {
    const [p1, , p3] = patients;

    const day = await reception.get(`/api/appointments?date=${MONDAY}`);
    expect(day.body.appointments.map((a: { queueNumber: number }) => a.queueNumber)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(day.body.counts).toMatchObject({ BOOKED: 3, CANCELLED: 1 });

    const found = await reception.get(`/api/appointments?q=${p3.phone}`);
    expect(found.body.appointments).toEqual([
      expect.objectContaining({ id: p3.appointmentId, allowedActions: ['CANCEL', 'CHECK_IN'] }),
    ]);

    // Too early to call anyone a no-show: the shift starts at 07:30.
    const early = await reception.post(`/api/appointments/${patients[3].appointmentId}/no-show`);
    expect(early.body.error.code).toBe('NO_SHOW_TOO_EARLY');

    for (const p of [p3, p1]) {
      const res = await reception.post(`/api/appointments/${p.appointmentId}/check-in`);
      expect(res.body.appointment.status).toBe('CHECKED_IN');
    }
    const note = await reception.post(`/api/appointments/${p1.appointmentId}/notes`, {
      content: 'Mang theo kết quả điện tim cũ.',
    });
    expect(note.status).toBe(201);
  });

  it('the doctor works through the queue in queue-number order (UC-D1..D5)', async () => {
    vi.setSystemTime(at('07:45'));
    const [p1, , p3] = patients;

    const schedule = await doctor.get('/api/doctor/schedule');
    expect(schedule.body.shifts).toEqual([
      expect.objectContaining({
        id: ids.entry,
        counts: expect.objectContaining({ CHECKED_IN: 2, BOOKED: 1 }),
      }),
    ]);
    const queue = await doctor.get(`/api/roster-entries/${ids.entry}/queue`);
    expect(queue.body.nextAppointmentId).toBe(p1.appointmentId); // lowest checked-in number

    const called = await doctor.post(`/api/roster-entries/${ids.entry}/call-next`);
    expect(called.body.appointment).toMatchObject({
      id: p1.appointmentId,
      status: 'IN_EXAMINATION',
    });
    expect(called.body.appointment.notes).toHaveLength(1); // the receptionist's note

    const busy = await doctor.post(`/api/appointments/${p3.appointmentId}/start`);
    expect(busy.body.error.code).toBe('DOCTOR_BUSY');

    await doctor.post(`/api/appointments/${p1.appointmentId}/notes`, {
      content: 'Huyết áp 130/85. Hẹn tái khám sau 1 tháng.',
    });
    const done = await doctor.post(`/api/appointments/${p1.appointmentId}/complete`);
    expect(done.body.appointment.status).toBe('COMPLETED');

    const next = await doctor.post(`/api/roster-entries/${ids.entry}/call-next`);
    expect(next.body.appointment.id).toBe(p3.appointmentId);
    await doctor.post(`/api/appointments/${p3.appointmentId}/complete`);

    const empty = await doctor.post(`/api/roster-entries/${ids.entry}/call-next`);
    expect(empty.body.error.code).toBe('NO_PATIENT_WAITING');
  });

  it('reception marks the patient who never came as a no-show (UC-R5)', async () => {
    const res = await reception.post(`/api/appointments/${patients[3].appointmentId}/no-show`);
    expect(res.body.appointment.status).toBe('NO_SHOW');
  });

  it('the patient sees the completed visit without the internal notes (UC-P5)', async () => {
    const [p1] = patients;
    const mine = await p1.api.get('/api/appointments/mine');
    expect(mine.body.appointments).toEqual([
      expect.objectContaining({ id: p1.appointmentId, status: 'COMPLETED', allowedActions: [] }),
    ]);
    expect(mine.body.appointments[0].notes).toBeUndefined();
    expect(mine.body.appointments[0].patient).toBeUndefined();
  });

  it('admin cannot delete a used roster entry, copies the week, and sees every appointment (UC-A6..A8)', async () => {
    const del = await admin.delete(`/api/admin/roster-entries/${ids.entry}`);
    expect(del.body.error.code).toBe('ROSTER_HAS_APPOINTMENTS');

    const copied = await admin.post('/api/admin/roster/copy-previous-week', {
      weekStart: NEXT_MONDAY,
    });
    expect(copied.body).toEqual({ sourceWeekStart: MONDAY, created: 1, skipped: [] });

    const week = await admin.get(`/api/admin/roster?weekStart=${NEXT_MONDAY}`);
    expect(week.body.entries).toEqual([
      expect.objectContaining({ date: NEXT_MONDAY, maxPatients: 3, activeCount: 0 }),
    ]);

    const all = await admin.get(`/api/appointments?date=${MONDAY}`);
    expect(all.body.counts).toMatchObject({ COMPLETED: 2, CANCELLED: 1, NO_SHOW: 1 });
  });

  it('deactivating the doctor ends their session at once and closes their shifts (UC-A3)', async () => {
    const res = await admin.post(`/api/admin/doctors/${ids.doctor}/deactivate`);
    expect(res.body.doctor.isActive).toBe(false);

    // The doctor's token is still valid, but every request re-checks the account.
    const blocked = await doctor.get('/api/doctor/schedule');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_DISABLED');
    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'bs.tam@clinic.local', password: PASSWORD });
    expect(relogin.body.error.code).toBe('ACCOUNT_DISABLED');

    // The copied shift next week no longer takes bookings.
    const availability = await patients[0].api.get(
      `/api/availability?specialtyId=${ids.specialty}`,
    );
    const nextMonday = availability.body.days.find((d: { date: string }) => d.date === NEXT_MONDAY);
    expect(nextMonday.shifts).toEqual([]);
  });
});
