import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Role } from '../src/domain/enums';
import { prisma, resetDatabase } from './helpers/db';

const app = createApp();

const validPatient = {
  fullName: 'Test Patient',
  email: 'Test.Patient@Example.com',
  phone: '0911222333',
  password: 'secret-pass',
  dateOfBirth: '1995-02-28',
  gender: 'FEMALE',
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/register', () => {
  it('creates a patient with a profile and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(validPatient);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      fullName: 'Test Patient',
      email: 'test.patient@example.com', // normalized
      role: Role.PATIENT,
    });
    expect(res.body.user.passwordHash).toBeUndefined();

    const profile = await prisma.patientProfile.findUnique({ where: { userId: res.body.user.id } });
    expect(profile).toMatchObject({ dateOfBirth: '1995-02-28', gender: 'FEMALE' });
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    await request(app).post('/api/auth/register').send(validPatient);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPatient, phone: '0999888777' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a duplicate phone with 409 PHONE_TAKEN', async () => {
    await request(app).post('/api/auth/register').send(validPatient);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validPatient, email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_TAKEN');
  });

  it('returns field-level validation errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        ...validPatient,
        email: 'not-an-email',
        password: 'short',
        dateOfBirth: '2999-01-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'email', code: 'EMAIL_INVALID' },
        { path: 'password', code: 'PASSWORD_TOO_SHORT' },
        { path: 'dateOfBirth', code: 'DATE_OF_BIRTH_IN_FUTURE' },
      ]),
    );
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validPatient);
  });

  it('logs in with email (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'TEST.patient@example.com', password: 'secret-pass' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(Role.PATIENT);
  });

  it('logs in with phone number', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '0911222333', password: 'secret-pass' });

    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '0911222333', password: 'wrong-pass' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a deactivated account with 403', async () => {
    await prisma.user.create({
      data: {
        fullName: 'Old Receptionist',
        email: 'old@clinic.local',
        phone: '0900111222',
        passwordHash: await bcrypt.hash('secret-pass', 4),
        role: Role.RECEPTIONIST,
        isActive: false,
      },
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'old@clinic.local', password: 'secret-pass' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { body } = await request(app).post('/api/auth/register').send(validPatient);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(body.user.id);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 401 for a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('unknown routes', () => {
  it('return 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
