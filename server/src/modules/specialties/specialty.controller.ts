import type { Request, Response } from 'express';
import { z } from 'zod';
import { id, nullableText } from '../../validation';
import type { SpecialtyService } from './specialty.service';

const params = z.object({ id: id() });

const specialtySchema = z.object({
  name: z.string().trim().min(2, 'NAME_REQUIRED').max(100, 'NAME_TOO_LONG'),
  description: nullableText(500, 'DESCRIPTION_TOO_LONG').optional(),
});

export class SpecialtyController {
  constructor(private readonly specialties: SpecialtyService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ specialties: await this.specialties.list() });
  };

  listDoctors = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ doctors: await this.specialties.listDoctors(id) });
  };

  // Admin (UC-A1)

  listAll = async (_req: Request, res: Response) => {
    res.json({ specialties: await this.specialties.listAll() });
  };

  create = async (req: Request, res: Response) => {
    const input = specialtySchema.parse(req.body ?? {});
    const specialty = await this.specialties.create({
      name: input.name,
      description: input.description ?? null,
    });
    res.status(201).json({ specialty });
  };

  update = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const changes = specialtySchema.partial().parse(req.body ?? {});
    res.json({ specialty: await this.specialties.update(id, changes) });
  };

  activate = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ specialty: await this.specialties.setActive(id, true) });
  };

  deactivate = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ specialty: await this.specialties.setActive(id, false) });
  };
}
