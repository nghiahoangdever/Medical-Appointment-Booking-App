import type { Request, Response } from 'express';
import { z } from 'zod';
import { id, nullableText } from '../../validation';
import type { RoomService } from './room.service';

const params = z.object({ id: id() });

const roomSchema = z.object({
  /** e.g. "B2-05": letters, digits and dashes, stored upper-case. */
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{0,9}$/, 'ROOM_CODE_INVALID'),
  name: z.string().trim().min(2, 'NAME_REQUIRED').max(100, 'NAME_TOO_LONG'),
  floor: nullableText(20, 'FLOOR_TOO_LONG').optional(),
});

/** UC-A2 (admin only). */
export class RoomController {
  constructor(private readonly rooms: RoomService) {}

  list = async (_req: Request, res: Response) => {
    res.json({ rooms: await this.rooms.list() });
  };

  create = async (req: Request, res: Response) => {
    const input = roomSchema.parse(req.body ?? {});
    const room = await this.rooms.create({ ...input, floor: input.floor ?? null });
    res.status(201).json({ room });
  };

  update = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const changes = roomSchema.partial().parse(req.body ?? {});
    res.json({ room: await this.rooms.update(id, changes) });
  };

  activate = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ room: await this.rooms.setActive(id, true) });
  };

  deactivate = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ room: await this.rooms.setActive(id, false) });
  };
}
