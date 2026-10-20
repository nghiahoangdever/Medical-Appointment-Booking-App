import { badRequest, conflict, notFound } from '../../domain/errors';
import { shiftRepository, type ShiftRepository } from './shift.repository';

export class ShiftService {
  constructor(private readonly shifts: ShiftRepository) {}

  /** The fixed clinic shifts, earliest first. */
  async list() {
    const shifts = await this.shifts.findAll();
    return shifts.map(({ id, name, startTime, endTime }) => ({ id, name, startTime, endTime }));
  }

  /**
   * UC-A5: change a shift's times. The start must be before the end and shifts may not overlap.
   * Existing roster entries and appointments follow the new times (they reference the shift).
   */
  async updateTimes(id: number, times: { startTime: string; endTime: string }) {
    const shift = await this.shifts.findById(id);
    if (!shift) throw notFound('SHIFT_NOT_FOUND', `Shift ${id} not found`);
    if (times.startTime >= times.endTime) {
      throw badRequest('SHIFT_TIMES_INVALID', 'The start time must be before the end time');
    }
    const others = (await this.shifts.findAll()).filter((s) => s.id !== id);
    const overlapping = others.find(
      (s) => times.startTime < s.endTime && s.startTime < times.endTime,
    );
    if (overlapping) {
      throw conflict('SHIFT_TIMES_OVERLAP', `Overlaps shift ${overlapping.name}`);
    }
    const { name, startTime, endTime } = await this.shifts.updateTimes(id, times);
    return { id, name, startTime, endTime };
  }
}

export const shiftService = new ShiftService(shiftRepository);
