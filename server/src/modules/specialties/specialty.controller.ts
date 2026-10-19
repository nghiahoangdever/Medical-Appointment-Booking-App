import type { Request, Response } from 'express';
import { z } from 'zod';
import { id } from '../../validation';
import type { SpecialtyService } from './specialty.service';

const params = z.object({ id: id() });

export class SpecialtyController {
  constructor(private readonly specialties: SpecialtyService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ specialties: await this.specialties.list() });
  };

  listDoctors = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ doctors: await this.specialties.listDoctors(id) });
  };
}
