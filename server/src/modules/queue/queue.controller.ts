import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../middleware/authenticate';
import { id } from '../../validation';
import type { QueueService } from './queue.service';

const params = z.object({ id: id() });

export class QueueController {
  constructor(private readonly queue: QueueService) {}

  schedule = async (req: Request, res: Response) => {
    res.json({ shifts: await this.queue.getSchedule(getAuthUser(req)) });
  };

  queueForEntry = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json(await this.queue.getQueue(getAuthUser(req), id));
  };

  callNext = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ appointment: await this.queue.callNext(getAuthUser(req), id) });
  };
}
