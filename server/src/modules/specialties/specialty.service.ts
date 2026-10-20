import { appClock } from '../../clock';
import { conflict, notFound } from '../../domain/errors';
import { systemClock, today, type Clock } from '../../domain/time';
import {
  appointmentRepository,
  type AppointmentRepository,
} from '../appointments/appointment.repository';
import { doctorRepository, type DoctorRepository } from '../doctors/doctor.repository';
import {
  specialtyRepository,
  type SpecialtyData,
  type SpecialtyRepository,
} from './specialty.repository';

export class SpecialtyService {
  constructor(
    private readonly specialties: SpecialtyRepository,
    private readonly doctors: DoctorRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** UC-P2: browse specialties. */
  async list() {
    const specialties = await this.specialties.findAllActive();
    return specialties.map(({ id, name, description }) => ({ id, name, description }));
  }

  /** UC-P2: doctors of a specialty (the optional doctor choice when booking). */
  async listDoctors(specialtyId: number) {
    const specialty = await this.specialties.findActiveById(specialtyId);
    if (!specialty) throw notFound('SPECIALTY_NOT_FOUND', `Specialty ${specialtyId} not found`);
    return this.doctors.findActiveBySpecialty(specialtyId);
  }

  // UC-A1: manage specialties

  async listAll() {
    const specialties = await this.specialties.findAllWithDoctorCounts();
    return specialties.map(({ _count, ...s }) => ({ ...s, activeDoctorCount: _count.doctors }));
  }

  async create(data: SpecialtyData) {
    await this.ensureNameFree(data.name);
    return this.specialties.create(data);
  }

  async update(id: number, data: Partial<SpecialtyData>) {
    await this.require(id);
    if (data.name !== undefined) await this.ensureNameFree(data.name, id);
    return this.specialties.update(id, data);
  }

  /**
   * Deactivated specialties disappear from booking (their doctors' roster entries stop taking
   * appointments). Blocked while appointments from today on are still open.
   */
  async setActive(id: number, isActive: boolean) {
    await this.require(id);
    if (!isActive) {
      const open = await this.appointments.countUpcomingOpen(
        { specialtyId: id },
        today(this.clock()),
      );
      if (open > 0) {
        throw conflict('HAS_UPCOMING_APPOINTMENTS', `${open} upcoming appointments are still open`);
      }
    }
    return this.specialties.update(id, { isActive });
  }

  private async require(id: number) {
    const specialty = await this.specialties.findById(id);
    if (!specialty) throw notFound('SPECIALTY_NOT_FOUND', `Specialty ${id} not found`);
    return specialty;
  }

  private async ensureNameFree(name: string, exceptId?: number) {
    const existing = await this.specialties.findByName(name);
    if (existing && existing.id !== exceptId) {
      throw conflict('SPECIALTY_NAME_TAKEN', `Specialty "${name}" already exists`);
    }
  }
}

export const specialtyService = new SpecialtyService(
  specialtyRepository,
  doctorRepository,
  appointmentRepository,
  appClock,
);
