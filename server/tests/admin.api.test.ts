// HTTP-level tests for Phase 5 (admin). Real clock: roster dates are relative to today.

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Role } from '../src/domain/enums';
import { addDays, startOfWeek, today } from '../src/domain/time';
import { prisma, resetDatabase } from './helpers/db';
import { addRoster, bearer, createClinic, createPatient, createStaff } from './helpers/fixtures';

const app = createApp();
const TOMORROW = addDays(today(), 1);

let clinic: Awaited<ReturnType<typeof createClinic>>;
let admin: Awaited<ReturnType<typeof createStaff>>;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
  admin = await createStaff(Role.ADMIN);
});
afterAll(() => prisma.$disconnect());

const asAdmin = (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object) => {
  const req = request(app)[method](`/api/admin${path}`).set('Authorization', bearer(admin));
  return body ? req.send(body) : req;
};

async function bookTomorrowMorning(doctorId: number, roomId: number) {
  await addRoster({ doctorId, roomId, shiftId: clinic.morning.id, date: TOMORROW, maxPatients: 5 });
  const patient = await createPatient();
  await request(app).post('/api/appointments').set('Authorization', bearer(patient)).send({
    specialtyId: clinic.specialty.id,
    doctorId,
    date: TOMORROW,
    shiftId: clinic.morning.id,
  });
}

describe('access', () => {
  it('is admin-only', async () => {
    const receptionist = await createStaff(Role.RECEPTIONIST);
    const res = await request(app)
      .get('/api/admin/rooms')
      .set('Authorization', bearer(receptionist));
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/admin/rooms')).status).toBe(401);
  });
});

describe('specialties', () => {
  it('creates, renames and rejects duplicate names', async () => {
    const created = await asAdmin('post', '/specialties', { name: 'Tim mạch', description: '' });
    expect(created.status).toBe(201);
    expect(created.body.specialty).toMatchObject({
      name: 'Tim mạch',
      description: null,
      isActive: true,
    });

    const dup = await asAdmin('post', '/specialties', { name: 'Tim mạch' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SPECIALTY_NAME_TAKEN');

    const renamed = await asAdmin('patch', `/specialties/${created.body.specialty.id}`, {
      description: 'Bệnh tim và mạch máu',
    });
    expect(renamed.body.specialty.description).toBe('Bệnh tim và mạch máu');
  });

  it('lists inactive ones with active doctor counts', async () => {
    const res = await asAdmin('get', '/specialties');
    const main = res.body.specialties.find((s: { id: number }) => s.id === clinic.specialty.id);
    expect(main).toMatchObject({ activeDoctorCount: 2, isActive: true });
  });

  it('blocks deactivation while appointments are open, then hides it from patients', async () => {
    await bookTomorrowMorning(clinic.doctorA.id, clinic.roomA.id);
    const blocked = await asAdmin('post', `/specialties/${clinic.specialty.id}/deactivate`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('HAS_UPCOMING_APPOINTMENTS');

    const other = await asAdmin('post', `/specialties/${clinic.otherSpecialty.id}/deactivate`);
    expect(other.body.specialty.isActive).toBe(false);
    const patient = await createPatient();
    const list = await request(app).get('/api/specialties').set('Authorization', bearer(patient));
    expect(list.body.specialties.map((s: { id: number }) => s.id)).not.toContain(
      clinic.otherSpecialty.id,
    );
  });
});

describe('rooms', () => {
  it('normalises codes to upper case and rejects duplicates and bad codes', async () => {
    const created = await asAdmin('post', '/rooms', {
      code: 'c3-01',
      name: 'Phòng C3-01',
      floor: '3',
    });
    expect(created.body.room).toMatchObject({ code: 'C3-01', floor: '3' });
    expect(
      (await asAdmin('post', '/rooms', { code: 'C3-01', name: 'Trùng' })).body.error.code,
    ).toBe('ROOM_CODE_TAKEN');
    const bad = await asAdmin('post', '/rooms', { code: 'phòng 1', name: 'X X' });
    expect(bad.body.error.details).toEqual([{ path: 'code', code: 'ROOM_CODE_INVALID' }]);
  });

  it('inactive rooms stop taking bookings', async () => {
    await addRoster({
      doctorId: clinic.doctorA.id,
      roomId: clinic.roomA.id,
      shiftId: clinic.morning.id,
      date: TOMORROW,
      maxPatients: 5,
    });
    const deactivated = await asAdmin('post', `/rooms/${clinic.roomA.id}/deactivate`);
    expect(deactivated.body.room.isActive).toBe(false);

    const patient = await createPatient();
    const res = await request(app)
      .get(`/api/availability?specialtyId=${clinic.specialty.id}`)
      .set('Authorization', bearer(patient));
    const tomorrow = res.body.days.find((d: { date: string }) => d.date === TOMORROW);
    expect(tomorrow.shifts).toEqual([]);
  });
});

describe('doctors and receptionists', () => {
  const doctorBody = () => ({
    fullName: 'Bác sĩ Mới',
    email: 'New.Doctor@Clinic.local',
    phone: '0987000111',
    password: 'secret-pass',
    specialtyId: clinic.specialty.id,
    title: 'BS.CKI',
  });

  it('creates a doctor who can then log in; email/phone must be unique', async () => {
    const created = await asAdmin('post', '/doctors', doctorBody());
    expect(created.status).toBe(201);
    expect(created.body.doctor).toMatchObject({
      email: 'new.doctor@clinic.local',
      isActive: true,
      specialty: { id: clinic.specialty.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '0987000111', password: 'secret-pass' });
    expect(login.body.user.role).toBe('DOCTOR');

    const dup = await asAdmin('post', '/doctors', { ...doctorBody(), phone: '0987000222' });
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('cannot add a doctor to an inactive specialty', async () => {
    await prisma.specialty.update({
      where: { id: clinic.specialty.id },
      data: { isActive: false },
    });
    const res = await asAdmin('post', '/doctors', doctorBody());
    expect(res.body.error.code).toBe('SPECIALTY_INACTIVE');
  });

  it('updates profile and resets the password; specialtyId is ignored on update', async () => {
    const res = await asAdmin('patch', `/doctors/${clinic.doctorA.id}`, {
      title: 'ThS.BS',
      password: 'new-password',
      specialtyId: clinic.otherSpecialty.id,
    });
    expect(res.body.doctor).toMatchObject({
      title: 'ThS.BS',
      specialty: { id: clinic.specialty.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clinic.doctorA.user.email, password: 'new-password' });
    expect(login.status).toBe(200);
  });

  it('blocks deactivating a doctor with open appointments', async () => {
    await bookTomorrowMorning(clinic.doctorA.id, clinic.roomA.id);
    const res = await asAdmin('post', `/doctors/${clinic.doctorA.id}/deactivate`);
    expect(res.body.error.code).toBe('HAS_UPCOMING_APPOINTMENTS');
    const free = await asAdmin('post', `/doctors/${clinic.doctorB.id}/deactivate`);
    expect(free.body.doctor.isActive).toBe(false);
  });

  it('manages receptionists; a deactivated one cannot log in', async () => {
    const created = await asAdmin('post', '/receptionists', {
      fullName: 'Lễ tân Mới',
      email: 'letan@clinic.local',
      phone: '0987000333',
      password: 'secret-pass',
    });
    const id = created.body.receptionist.id;
    await asAdmin('post', `/receptionists/${id}/deactivate`);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'letan@clinic.local', password: 'secret-pass' });
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');

    const notReceptionist = await asAdmin('post', `/receptionists/${admin.id}/deactivate`);
    expect(notReceptionist.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('shift times', () => {
  it('validates format, order and overlap', async () => {
    const bad = await asAdmin('patch', `/shifts/${clinic.morning.id}`, {
      startTime: '7:30',
      endTime: '11:30',
    });
    expect(bad.body.error.details).toEqual([{ path: 'startTime', code: 'TIME_INVALID' }]);

    const reversed = await asAdmin('patch', `/shifts/${clinic.morning.id}`, {
      startTime: '11:00',
      endTime: '10:00',
    });
    expect(reversed.body.error.code).toBe('SHIFT_TIMES_INVALID');

    const overlap = await asAdmin('patch', `/shifts/${clinic.morning.id}`, {
      startTime: '07:00',
      endTime: '13:30',
    });
    expect(overlap.body.error.code).toBe('SHIFT_TIMES_OVERLAP');

    const ok = await asAdmin('patch', `/shifts/${clinic.morning.id}`, {
      startTime: '07:00',
      endTime: '11:00',
    });
    expect(ok.body.shift).toMatchObject({ startTime: '07:00', endTime: '11:00' });
  });
});

describe('roster endpoints', () => {
  it('requires a Monday for the week', async () => {
    const monday = startOfWeek(today());
    expect((await asAdmin('get', `/roster?weekStart=${monday}`)).status).toBe(200);
    const res = await asAdmin('get', `/roster?weekStart=${addDays(monday, 1)}`);
    expect(res.body.error.details).toEqual([{ path: 'weekStart', code: 'WEEK_START_NOT_MONDAY' }]);
  });

  it('creates, reports conflicts, updates, and deletes entries', async () => {
    const body = {
      doctorId: clinic.doctorA.id,
      roomId: clinic.roomA.id,
      shiftId: clinic.morning.id,
      date: TOMORROW,
      maxPatients: 4,
    };
    const created = await asAdmin('post', '/roster-entries', body);
    expect(created.status).toBe(201);
    const conflict = await asAdmin('post', '/roster-entries', { ...body, roomId: clinic.roomB.id });
    expect(conflict.body.error.code).toBe('ROSTER_DOCTOR_CONFLICT');

    const badCapacity = await asAdmin('patch', `/roster-entries/${created.body.entry.id}`, {
      maxPatients: 0,
    });
    expect(badCapacity.body.error.details).toEqual([
      { path: 'maxPatients', code: 'MAX_PATIENTS_INVALID' },
    ]);

    const updated = await asAdmin('patch', `/roster-entries/${created.body.entry.id}`, {
      maxPatients: 8,
    });
    expect(updated.body.entry.maxPatients).toBe(8);

    expect((await asAdmin('delete', `/roster-entries/${created.body.entry.id}`)).status).toBe(204);
  });

  it('copies the previous week', async () => {
    const nextMonday = addDays(startOfWeek(today()), 7);
    await addRoster({
      doctorId: clinic.doctorA.id,
      roomId: clinic.roomA.id,
      shiftId: clinic.morning.id,
      date: addDays(nextMonday, 2),
      maxPatients: 5,
    });
    const res = await asAdmin('post', '/roster/copy-previous-week', {
      weekStart: addDays(nextMonday, 7),
    });
    expect(res.body).toMatchObject({ sourceWeekStart: nextMonday, created: 1, skipped: [] });
  });
});
