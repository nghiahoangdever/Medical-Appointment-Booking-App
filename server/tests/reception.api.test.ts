// HTTP-level tests for Phase 3 (reception) endpoints. Real clock, so appointments are
// booked for tomorrow: check-in is "not today" and no-show is "too early" for them.

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
let receptionist: Awaited<ReturnType<typeof createStaff>>;
let appointmentId: number;
let appointmentCode: string;

beforeEach(async () => {
  await resetDatabase();
  clinic = await createClinic();
  patient = await createPatient();
  receptionist = await createStaff(Role.RECEPTIONIST);
  await addRoster({
    doctorId: clinic.doctorA.id,
    roomId: clinic.roomA.id,
    shiftId: clinic.morning.id,
    date: TOMORROW,
    maxPatients: 5,
  });
  const res = await request(app)
    .post('/api/appointments')
    .set('Authorization', bearer(patient))
    .send({ specialtyId: clinic.specialty.id, date: TOMORROW, shiftId: clinic.morning.id });
  appointmentId = res.body.appointment.id;
  appointmentCode = res.body.appointment.code;
});
afterAll(() => prisma.$disconnect());

const asReception = (req: request.Test) => req.set('Authorization', bearer(receptionist));

describe('GET /api/appointments (staff list)', () => {
  it('returns staff views with patient details, notes and counts', async () => {
    const res = await asReception(request(app).get(`/api/appointments?date=${TOMORROW}`));
    expect(res.status).toBe(200);
    expect(res.body.counts).toMatchObject({ BOOKED: 1, CHECKED_IN: 0 });
    expect(res.body.appointments[0]).toMatchObject({
      id: appointmentId,
      patient: { id: patient.id, phone: patient.phone },
      notes: [],
      allowedActions: ['CANCEL'], // tomorrow: no check-in or no-show yet
    });
  });

  it('searches by code without a date', async () => {
    const res = await asReception(request(app).get(`/api/appointments?q=${appointmentCode}`));
    expect(res.body.appointments.map((a: { id: number }) => a.id)).toEqual([appointmentId]);
  });

  it('requires a date or a search query', async () => {
    const res = await asReception(request(app).get('/api/appointments'));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'date', code: 'DATE_OR_QUERY_REQUIRED' }]);
  });

  it('validates the status filter', async () => {
    const res = await asReception(
      request(app).get(`/api/appointments?date=${TOMORROW}&status=LOST`),
    );
    expect(res.body.error.details).toEqual([{ path: 'status', code: 'STATUS_INVALID' }]);
  });

  it('is not available to patients or doctors', async () => {
    const asPatient = await request(app)
      .get(`/api/appointments?date=${TOMORROW}`)
      .set('Authorization', bearer(patient));
    expect(asPatient.status).toBe(403);

    const doctorUser = { id: clinic.doctorA.userId, role: Role.DOCTOR };
    const asDoctor = await request(app)
      .get(`/api/appointments?date=${TOMORROW}`)
      .set('Authorization', bearer(doctorUser));
    expect(asDoctor.status).toBe(403);
  });
});

describe('POST /api/appointments/:id/check-in and /no-show', () => {
  it('rejects check-in before the appointment date', async () => {
    const res = await asReception(request(app).post(`/api/appointments/${appointmentId}/check-in`));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECK_IN_NOT_TODAY');
  });

  it('rejects no-show before the shift starts', async () => {
    const res = await asReception(request(app).post(`/api/appointments/${appointmentId}/no-show`));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_SHOW_TOO_EARLY');
  });

  it('is reception-only', async () => {
    const res = await request(app)
      .post(`/api/appointments/${appointmentId}/check-in`)
      .set('Authorization', bearer(patient));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/appointments/:id/notes', () => {
  it('adds a note and returns the staff view', async () => {
    const res = await asReception(
      request(app)
        .post(`/api/appointments/${appointmentId}/notes`)
        .send({ content: '  Dị ứng penicillin  ' }),
    );
    expect(res.status).toBe(201);
    expect(res.body.appointment.notes).toEqual([
      expect.objectContaining({
        content: 'Dị ứng penicillin',
        author: { fullName: receptionist.fullName, role: 'RECEPTIONIST' },
      }),
    ]);
  });

  it('validates content', async () => {
    const empty = await asReception(
      request(app).post(`/api/appointments/${appointmentId}/notes`).send({ content: '   ' }),
    );
    expect(empty.body.error.details).toEqual([{ path: 'content', code: 'NOTE_REQUIRED' }]);

    const missing = await asReception(
      request(app).post(`/api/appointments/${appointmentId}/notes`),
    );
    expect(missing.body.error.details).toEqual([{ path: 'content', code: 'NOTE_REQUIRED' }]);

    const long = await asReception(
      request(app)
        .post(`/api/appointments/${appointmentId}/notes`)
        .send({ content: 'x'.repeat(1001) }),
    );
    expect(long.body.error.details).toEqual([{ path: 'content', code: 'NOTE_TOO_LONG' }]);
  });

  it('keeps notes out of the patient view', async () => {
    await asReception(
      request(app).post(`/api/appointments/${appointmentId}/notes`).send({ content: 'Nội bộ' }),
    );
    const res = await request(app)
      .get('/api/appointments/mine')
      .set('Authorization', bearer(patient));
    expect(res.body.appointments[0].notes).toBeUndefined();
    expect(res.body.appointments[0].patient).toBeUndefined();
    expect(res.body.appointments[0].allowedActions).toEqual(['CANCEL']);
  });
});

describe('staff cancel and reference data', () => {
  it('returns the staff view when reception cancels', async () => {
    const res = await asReception(
      request(app)
        .post(`/api/appointments/${appointmentId}/cancel`)
        .send({ reason: 'Gọi điện hủy' }),
    );
    expect(res.status).toBe(200);
    expect(res.body.appointment).toMatchObject({
      status: 'CANCELLED',
      patient: { id: patient.id },
    });
  });

  it('GET /api/shifts lists the shifts by start time', async () => {
    const res = await asReception(request(app).get('/api/shifts'));
    expect(res.body.shifts.map((s: { startTime: string }) => s.startTime)).toEqual([
      '07:30',
      '13:00',
    ]);
  });

  it('GET /api/health reports the real clock in tests', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toMatchObject({ status: 'ok', fakeClock: false });
  });
});
