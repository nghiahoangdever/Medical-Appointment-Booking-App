import { notFound } from '../../domain/errors';
import { doctorRepository, type DoctorRepository } from '../doctors/doctor.repository';
import { specialtyRepository, type SpecialtyRepository } from './specialty.repository';

export class SpecialtyService {
  constructor(
    private readonly specialties: SpecialtyRepository,
    private readonly doctors: DoctorRepository,
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
}

export const specialtyService = new SpecialtyService(specialtyRepository, doctorRepository);
