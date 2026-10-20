// HTTP-level tests for Phase 4 (doctor) endpoints. Real clock, so the roster is for tomorrow:
// nobody can be checked in yet, which exercises the error paths and access rules.

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
let doctorA: { id: number; role: string };
let doctorB: { id: number; role: string };
let entryId: number;
let appointmentId: number;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
  doctorA = { id: clinic.doctorA.userId, role: Role.DOCTOR };
  doctorB = { id: clinic.doctorB.userId, role: Role.DOCTOR };
  const entry = await addRoster({
    doctorId: clinic.doctorA.id,
    roomId: clinic.roomA.id,
    shiftId: clinic.morning.id,
    date: TOMORROW,
    maxPatients: 5,
  });
  entryId = entry.id;
  const patient = await createPatient();
  const res = await request(app)
    .post('/api/appointments')
    .set('Authorization', bearer(patient))
    .send({ specialtyId: clinic.specialty.id, date: TOMORROW, shiftId: clinic.morning.id });
  appointmentId = res.body.appointment.id;
});
afterAll(() => prisma.$disconnect());

describe('GET /api/doctor/schedule', () => {
  it("returns the doctor's upcoming shifts with counts", async () => {
    const res = await request(app)
      .get('/api/doctor/schedule')
      .set('Authorization', bearer(doctorA));
    expect(res.status).toBe(200);
    expect(res.body.shifts).toEqual([
      expect.objectContaining({
        id: entryId,
        date: TOMORROW,
        counts: expect.objectContaining({ BOOKED: 1 }),
      }),
    ]);
    expect(res.body.shifts[0].doctorUserId).toBeUndefined();
  });

  it('is doctor-only', async () => {
    const receptionist = await createStaff(Role.RECEPTIONIST);
    const res = await request(app)
      .get('/api/doctor/schedule')
      .set('Authorization', bearer(receptionist));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/roster-entries/:id/queue', () => {
  it('returns the queue for the owner', async () => {
    const res = await request(app)
      .get(`/api/roster-entries/${entryId}/queue`)
      .set('Authorization', bearer(doctorA));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      entry: { id: entryId },
      appointments: [{ id: appointmentId, status: 'BOOKED', allowedActions: [] }],
      nextAppointmentId: null,
      inExaminationElsewhere: null,
    });
  });

  it('returns 404 to another doctor', async () => {
    const res = await request(app)
      .get(`/api/roster-entries/${entryId}/queue`)
      .set('Authorization', bearer(doctorB));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROSTER_ENTRY_NOT_FOUND');
  });
});

describe('doctor actions', () => {
  it('call-next with nobody checked in → 409 NO_PATIENT_WAITING', async () => {
    const res = await request(app)
      .post(`/api/roster-entries/${entryId}/call-next`)
      .set('Authorization', bearer(doctorA));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_PATIENT_WAITING');
  });

  it('start on a BOOKED appointment → 409 INVALID_STATUS_TRANSITION', async () => {
    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/start`)
      .set('Authorization', bearer(doctorA));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('no-show before the shift → 409 NO_SHOW_TOO_EARLY', async () => {
    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/no-show`)
      .set('Authorization', bearer(doctorA));
    expect(res.body.error.code).toBe('NO_SHOW_TOO_EARLY');
  });

  it("another doctor's appointment looks nonexistent", async () => {
    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/notes`)
      .set('Authorization', bearer(doctorB))
      .send({ content: 'x' });
    expect(res.status).toBe(404);
  });

  it('own patient: the doctor can add a note', async () => {
    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/notes`)
      .set('Authorization', bearer(doctorA))
      .send({ content: 'Cần xét nghiệm máu' });
    expect(res.status).toBe(201);
    expect(res.body.appointment.notes[0].author.role).toBe('DOCTOR');
  });

  it('start / complete / call-next are doctor-only', async () => {
    const receptionist = await createStaff(Role.RECEPTIONIST);
    for (const path of [
      `/api/appointments/${appointmentId}/start`,
      `/api/appointments/${appointmentId}/complete`,
      `/api/roster-entries/${entryId}/call-next`,
    ]) {
      const res = await request(app).post(path).set('Authorization', bearer(receptionist));
      expect(res.status).toBe(403);
    }
  });

  it('unknown /api routes still return 404, not 401', async () => {
    const res = await request(app).get('/api/roster-entries');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
