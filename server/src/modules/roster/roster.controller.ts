import type { Request, Response } from 'express';
import { z } from 'zod';
import { MAX_PATIENTS_LIMIT } from '../../domain/rosterRules';
import { dayOfWeek } from '../../domain/time';
import { dateString, id } from '../../validation';
import type { RosterService } from './roster.service';

const params = z.object({ id: id() });

const weekStart = () => dateString().refine((d) => dayOfWeek(d) === 0, 'WEEK_START_NOT_MONDAY');

const maxPatients = () =>
  z
    .number({ error: 'MAX_PATIENTS_INVALID' })
    .int('MAX_PATIENTS_INVALID')
    .min(1, 'MAX_PATIENTS_INVALID')
    .max(MAX_PATIENTS_LIMIT, 'MAX_PATIENTS_INVALID');

const createSchema = z.object({
  doctorId: id(),
  roomId: id(),
  shiftId: id(),
  date: dateString(),
  maxPatients: maxPatients(),
});

const updateSchema = z.object({ roomId: id().optional(), maxPatients: maxPatients().optional() });

/** UC-A6 / UC-A7 (admin only). */
export class RosterController {
  constructor(private readonly roster: RosterService) {}

  week = async (req: Request, res: Response) => {
    const query = z.object({ weekStart: weekStart() }).parse(req.query);
    res.json(await this.roster.getWeek(query.weekStart));
  };

  create = async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body ?? {});
    res.status(201).json({ entry: await this.roster.createEntry(input) });
  };

  update = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const changes = updateSchema.parse(req.body ?? {});
    res.json({ entry: await this.roster.updateEntry(id, changes) });
  };

  remove = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    await this.roster.deleteEntry(id);
    res.status(204).end();
  };

  copyPreviousWeek = async (req: Request, res: Response) => {
    const body = z.object({ weekStart: weekStart() }).parse(req.body ?? {});
    res.json(await this.roster.copyPreviousWeek(body.weekStart));
  };
}
