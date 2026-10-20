import { shiftRepository, type ShiftRepository } from './shift.repository';

export class ShiftService {
  constructor(private readonly shifts: ShiftRepository) {}

  /** The fixed clinic shifts, earliest first. */
  async list() {
    const shifts = await this.shifts.findAll();
    return shifts.map(({ id, name, startTime, endTime }) => ({ id, name, startTime, endTime }));
  }
}

export const shiftService = new ShiftService(shiftRepository);
