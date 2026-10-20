import type { Request, Response } from 'express';
import { z } from 'zod';
import { id, timeOfDay } from '../../validation';
import type { ShiftService } from './shift.service';

const params = z.object({ id: id() });
const timesSchema = z.object({ startTime: timeOfDay(), endTime: timeOfDay() });

export class ShiftController {
  constructor(private readonly shifts: ShiftService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ shifts: await this.shifts.list() });
  };

  /** UC-A5 (admin only). */
  updateTimes = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const times = timesSchema.parse(req.body ?? {});
    res.json({ shift: await this.shifts.updateTimes(id, times) });
  };
}
