import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import type { Gender, Role } from '../../domain/enums';
import { conflict, forbidden, unauthorized } from '../../domain/errors';
import { userRepository, type UserRepository } from '../users/user.repository';
import { signToken } from './token';

const BCRYPT_ROUNDS = 10;

export interface RegisterPatientInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string;
}

/** User data that is safe to send to the client. */
export interface PublicUser {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  /** UC-P1: only patients self-register; staff accounts are created by Admin. */
  async registerPatient(input: RegisterPatientInput): Promise<AuthResult> {
    const existing = await this.users.findConflicting(input.email, input.phone);
    if (existing?.email === input.email) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    if (existing) {
      throw conflict('PHONE_TAKEN', 'An account with this phone number already exists.');
    }

    const user = await this.users.createPatient({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      profile: { dateOfBirth: input.dateOfBirth, gender: input.gender, address: input.address },
    });
    return this.toAuthResult(user);
  }

  async login(identifier: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmailOrPhone(identifier);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized('INVALID_CREDENTIALS', 'Incorrect email/phone or password.');
    }
    if (!user.isActive) {
      throw forbidden('ACCOUNT_DISABLED', 'This account has been deactivated.');
    }
    return this.toAuthResult(user);
  }

  async getCurrentUser(userId: number): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw unauthorized('INVALID_TOKEN', 'Your session is no longer valid. Please log in again.');
    }
    return toPublicUser(user);
  }

  private toAuthResult(user: User): AuthResult {
    const publicUser = toPublicUser(user);
    return { token: signToken({ userId: user.id, role: publicUser.role }), user: publicUser };
  }
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role as Role,
  };
}

export const authService = new AuthService(userRepository);
