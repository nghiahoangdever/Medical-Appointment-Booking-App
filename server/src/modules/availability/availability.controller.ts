import type { Request, Response } from 'express';
import { z } from 'zod';
import { id } from '../../validation';
import type { AvailabilityService } from './availability.service';

const query = z.object({
  specialtyId: id(),
  doctorId: id().optional(),
});

export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  get = async (req: Request, res: Response) => {
    const { specialtyId, doctorId } = query.parse(req.query);
    res.json(await this.availability.getAvailability(specialtyId, doctorId));
  };
}
