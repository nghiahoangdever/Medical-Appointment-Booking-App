// HTTP-level tests for Phase 2 endpoints (real clock, so dates are relative to today).

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Role } from '../src/domain/enums';
import { addDays, today } from '../src/domain/time';
import { prisma, resetDatabase } from './helpers/db';
import { addRoster, bearer, createClinic, createPatient, createStaff } from './helpers/fixtures';

const app = createApp();
const TOMORROW = addDays(today(), 1);

let clinic: Awaited<ReturnType<typeof createClinic>>;
let patient: Awaited<ReturnType<typeof createPatient>>;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
  patient = await createPatient();
  const { doctorA, doctorB, roomA, roomB, morning } = clinic;
  await addRoster({
    doctorId: doctorA.id,
    roomId: roomA.id,
    shiftId: morning.id,
    date: TOMORROW,
    maxPatients: 3,
  });
  await addRoster({
    doctorId: doctorB.id,
    roomId: roomB.id,
    shiftId: morning.id,
    date: TOMORROW,
    maxPatients: 2,
  });
});
afterAll(() => prisma.$disconnect());

const book = (user: { id: number; role: string }, body: object) =>
  request(app).post('/api/appointments').set('Authorization', bearer(user)).send(body);

const bookTomorrowMorning = (user = patient) =>
  book(user, { specialtyId: clinic.specialty.id, date: TOMORROW, shiftId: clinic.morning.id });

describe('GET /api/specialties', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/specialties')).status).toBe(401);
  });

  it('lists active specialties and their doctors', async () => {
    await prisma.specialty.update({
      where: { id: clinic.otherSpecialty.id },
      data: { isActive: false },
    });
    const list = await request(app).get('/api/specialties').set('Authorization', bearer(patient));
    expect(list.body.specialties.map((s: { id: number }) => s.id)).toEqual([clinic.specialty.id]);

    const doctors = await request(app)
      .get(`/api/specialties/${clinic.specialty.id}/doctors`)
      .set('Authorization', bearer(patient));
    expect(doctors.body.doctors.map((d: { id: number }) => d.id)).toEqual([
      clinic.doctorA.id,
      clinic.doctorB.id,
    ]);
  });

  it('returns 404 SPECIALTY_NOT_FOUND for an unknown specialty', async () => {
    const res = await request(app)
      .get('/api/specialties/9999/doctors')
      .set('Authorization', bearer(patient));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SPECIALTY_NOT_FOUND');
  });
});

describe('GET /api/availability', () => {
  const availability = (query: string) =>
    request(app).get(`/api/availability?${query}`).set('Authorization', bearer(patient));

  it('returns 14 days with remaining places per shift, updated after a booking', async () => {
    const before = await availability(`specialtyId=${clinic.specialty.id}`);
    expect(before.status).toBe(200);
    expect(before.body.days).toHaveLength(14);
    const tomorrow = before.body.days.find((d: { date: string }) => d.date === TOMORROW);
    expect(tomorrow.shifts).toEqual([
      expect.objectContaining({
        shiftId: clinic.morning.id,
        doctorsOnDuty: 2,
        remainingSlots: 5,
        status: 'AVAILABLE',
      }),
    ]);

    await bookTomorrowMorning();
    const after = await availability(`specialtyId=${clinic.specialty.id}`);
    const tomorrowAfter = after.body.days.find((d: { date: string }) => d.date === TOMORROW);
    expect(tomorrowAfter.shifts[0].remainingSlots).toBe(4);
  });

  it('narrows to one doctor and reports FULL', async () => {
    const other = await createPatient();
    await book(patient, {
      specialtyId: clinic.specialty.id,
      doctorId: clinic.doctorB.id,
      date: TOMORROW,
      shiftId: clinic.morning.id,
    });
    await book(other, {
      specialtyId: clinic.specialty.id,
      doctorId: clinic.doctorB.id,
      date: TOMORROW,
      shiftId: clinic.morning.id,
    });

    const res = await availability(
      `specialtyId=${clinic.specialty.id}&doctorId=${clinic.doctorB.id}`,
    );
    const tomorrow = res.body.days.find((d: { date: string }) => d.date === TOMORROW);
    expect(tomorrow.shifts[0]).toMatchObject({
      doctorsOnDuty: 1,
      remainingSlots: 0,
      status: 'FULL',
    });
  });

  it('rejects a doctor from another specialty (DOCTOR_NOT_FOUND)', async () => {
    const res = await availability(
      `specialtyId=${clinic.otherSpecialty.id}&doctorId=${clinic.doctorA.id}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DOCTOR_NOT_FOUND');
  });

  it('validates query parameters with error codes', async () => {
    const res = await availability('specialtyId=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'specialtyId', code: 'ID_INVALID' }]);
  });
});

describe('POST /api/appointments', () => {
  it('books and returns the code and queue number', async () => {
    const res = await bookTomorrowMorning();
    expect(res.status).toBe(201);
    expect(res.body.appointment).toMatchObject({
      status: 'BOOKED',
      queueNumber: 1,
      date: TOMORROW,
      doctor: { id: clinic.doctorA.id },
      room: { code: clinic.roomA.code },
    });
    expect(res.body.appointment.code).toMatch(/^AP-[A-Z2-9]{6}$/);
  });

  it('is only for patients', async () => {
    const doctorUser = { id: clinic.doctorA.userId, role: Role.DOCTOR };
    const res = await bookTomorrowMorning(doctorUser as typeof patient);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('reports invalid fields as codes', async () => {
    const res = await book(patient, { specialtyId: clinic.specialty.id, date: '2026-02-30' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'date', code: 'DATE_INVALID' },
        { path: 'shiftId', code: 'ID_INVALID' },
      ]),
    );
  });

  it('returns 409 DUPLICATE_BOOKING for a second booking in the same shift', async () => {
    await bookTomorrowMorning();
    const res = await bookTomorrowMorning();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_BOOKING');
  });
});

describe('GET /api/appointments/mine and cancel', () => {
  it("lists only the patient's own appointments", async () => {
    const other = await createPatient();
    await bookTomorrowMorning();
    await bookTomorrowMorning(other);

    const res = await request(app)
      .get('/api/appointments/mine')
      .set('Authorization', bearer(patient));
    expect(res.status).toBe(200);
    expect(res.body.appointments).toHaveLength(1);
  });

  it('cancels own appointment, then rejects a second cancel', async () => {
    const { body } = await bookTomorrowMorning();
    const cancel = () =>
      request(app)
        .post(`/api/appointments/${body.appointment.id}/cancel`)
        .set('Authorization', bearer(patient))
        .send({ reason: 'Có việc đột xuất' });

    const first = await cancel();
    expect(first.status).toBe(200);
    expect(first.body.appointment).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Có việc đột xuất',
    });

    const second = await cancel();
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it("returns 404 for another patient's appointment", async () => {
    const { body } = await bookTomorrowMorning();
    const other = await createPatient();
    const res = await request(app)
      .post(`/api/appointments/${body.appointment.id}/cancel`)
      .set('Authorization', bearer(other));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  it('lets a receptionist cancel without a body; doctors cannot', async () => {
    const { body } = await bookTomorrowMorning();
    const doctorUser = { id: clinic.doctorA.userId, role: Role.DOCTOR };
    const asDoctor = await request(app)
      .post(`/api/appointments/${body.appointment.id}/cancel`)
      .set('Authorization', bearer(doctorUser));
    expect(asDoctor.status).toBe(403);

    const receptionist = await createStaff(Role.RECEPTIONIST);
    const res = await request(app)
      .post(`/api/appointments/${body.appointment.id}/cancel`)
      .set('Authorization', bearer(receptionist));
    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('CANCELLED');
  });
});
