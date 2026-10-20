import { appClock } from '../../clock';
import { Role } from '../../domain/enums';
import { conflict, notFound } from '../../domain/errors';
import { systemClock, today, type Clock } from '../../domain/time';
import {
  appointmentRepository,
  type AppointmentRepository,
} from '../appointments/appointment.repository';
import { doctorRepository, type DoctorRepository } from '../doctors/doctor.repository';
import { specialtyRepository, type SpecialtyRepository } from '../specialties/specialty.repository';
import { hashPassword } from '../users/password';
import { userRepository, type AccountUpdate, type UserRepository } from '../users/user.repository';

export interface AccountInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface DoctorInput extends AccountInput {
  specialtyId: number;
  title: string;
  bio?: string;
}

/** Fields an admin may change. The password is optional (set it to reset the password). */
export type AccountChanges = Partial<AccountInput>;
export type DoctorChanges = AccountChanges & { title?: string; bio?: string | null };

type DoctorAccount = NonNullable<Awaited<ReturnType<DoctorRepository['findAccountById']>>>;

function toDoctorView(d: DoctorAccount) {
  return {
    id: d.id,
    userId: d.user.id,
    fullName: d.user.fullName,
    email: d.user.email,
    phone: d.user.phone,
    isActive: d.user.isActive,
    title: d.title,
    bio: d.bio,
    specialty: d.specialty,
  };
}

/**
 * UC-A3 / UC-A4: staff accounts. A doctor's specialty is fixed after creation, because past and
 * future appointments reach their specialty through the doctor. Admin accounts are not managed
 * here.
 */
export class StaffService {
  constructor(
    private readonly users: UserRepository,
    private readonly doctors: DoctorRepository,
    private readonly specialties: SpecialtyRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  // Doctors

  async listDoctors() {
    return (await this.doctors.findAllAccounts()).map(toDoctorView);
  }

  async createDoctor(input: DoctorInput) {
    const specialty = await this.specialties.findById(input.specialtyId);
    if (!specialty) {
      throw notFound('SPECIALTY_NOT_FOUND', `Specialty ${input.specialtyId} not found`);
    }
    if (!specialty.isActive) {
      throw conflict('SPECIALTY_INACTIVE', 'Doctors cannot be added to an inactive specialty');
    }
    await this.ensureContactFree(input.email, input.phone);
    const doctor = await this.doctors.createAccount({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      specialtyId: input.specialtyId,
      title: input.title,
      bio: input.bio ?? null,
    });
    return toDoctorView(doctor);
  }

  async updateDoctor(id: number, changes: DoctorChanges) {
    const doctor = await this.requireDoctor(id);
    const { title, bio, ...account } = changes;
    await this.updateAccountFields(doctor.user.id, doctor.user, account);
    if (title !== undefined || bio !== undefined) {
      await this.doctors.updateProfile(id, { title, bio });
    }
    return toDoctorView((await this.doctors.findAccountById(id))!);
  }

  /** Deactivated doctors can't log in, book or be rostered. Blocked while they have open appointments. */
  async setDoctorActive(id: number, isActive: boolean) {
    const doctor = await this.requireDoctor(id);
    if (!isActive) {
      const open = await this.appointments.countUpcomingOpen({ doctorId: id }, today(this.clock()));
      if (open > 0) {
        throw conflict('HAS_UPCOMING_APPOINTMENTS', `${open} upcoming appointments are still open`);
      }
    }
    await this.users.updateAccount(doctor.user.id, { isActive });
    return toDoctorView((await this.doctors.findAccountById(id))!);
  }

  // Receptionists

  listReceptionists() {
    return this.users.findAccountsByRole(Role.RECEPTIONIST);
  }

  async createReceptionist(input: AccountInput) {
    await this.ensureContactFree(input.email, input.phone);
    return this.users.createAccount({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      role: Role.RECEPTIONIST,
    });
  }

  async updateReceptionist(id: number, changes: AccountChanges) {
    const user = await this.requireReceptionist(id);
    await this.updateAccountFields(id, user, changes);
    return (await this.users.findAccountById(id))!;
  }

  async setReceptionistActive(id: number, isActive: boolean) {
    await this.requireReceptionist(id);
    return this.users.updateAccount(id, { isActive });
  }

  // Shared

  private async updateAccountFields(
    userId: number,
    current: { email: string; phone: string },
    changes: AccountChanges,
  ) {
    const email = changes.email ?? current.email;
    const phone = changes.phone ?? current.phone;
    if (changes.email !== undefined || changes.phone !== undefined) {
      await this.ensureContactFree(email, phone, userId);
    }
    const data: AccountUpdate = {
      fullName: changes.fullName,
      email: changes.email,
      phone: changes.phone,
    };
    if (changes.password) data.passwordHash = await hashPassword(changes.password);
    await this.users.updateAccount(userId, data);
  }

  private async ensureContactFree(email: string, phone: string, exceptUserId?: number) {
    const existing = await this.users.findConflicting(email, phone, exceptUserId);
    if (existing?.email === email) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }
    if (existing) throw conflict('PHONE_TAKEN', 'An account with this phone number already exists');
  }

  private async requireDoctor(id: number) {
    const doctor = await this.doctors.findAccountById(id);
    if (!doctor) throw notFound('DOCTOR_NOT_FOUND', `Doctor ${id} not found`);
    return doctor;
  }

  private async requireReceptionist(id: number) {
    const user = await this.users.findAccountById(id);
    if (!user || user.role !== Role.RECEPTIONIST) {
      throw notFound('USER_NOT_FOUND', `Receptionist ${id} not found`);
    }
    return user;
  }
}

export const staffService = new StaffService(
  userRepository,
  doctorRepository,
  specialtyRepository,
  appointmentRepository,
  appClock,
);
