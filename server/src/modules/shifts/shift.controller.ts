import type { Request, Response } from 'express';
import type { ShiftService } from './shift.service';

export class ShiftController {
  constructor(private readonly shifts: ShiftService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ shifts: await this.shifts.list() });
  };
}
