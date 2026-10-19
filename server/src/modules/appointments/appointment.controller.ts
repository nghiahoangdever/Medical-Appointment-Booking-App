import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../middleware/authenticate';
import { dateString, id } from '../../validation';
import type { AppointmentService } from './appointment.service';
import type { BookingService } from './booking.service';

/** Optional free text; blank becomes undefined. */
const optionalText = (max: number, tooLongCode: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongCode)
    .optional()
    .transform((s) => s || undefined);

const bookSchema = z.object({
  specialtyId: id(),
  doctorId: id().optional(),
  date: dateString(),
  shiftId: id(),
  reason: optionalText(500, 'REASON_TOO_LONG'),
});

const cancelSchema = z.object({
  reason: optionalText(500, 'REASON_TOO_LONG'),
});

const params = z.object({ id: id() });

export class AppointmentController {
  constructor(
    private readonly booking: BookingService,
    private readonly appointments: AppointmentService,
  ) {}

  book = async (req: Request, res: Response) => {
    const input = bookSchema.parse(req.body);
    res.status(201).json({ appointment: await this.booking.book(getAuthUser(req).id, input) });
  };

  listMine = async (req: Request, res: Response) => {
    res.json({ appointments: await this.appointments.listForPatient(getAuthUser(req).id) });
  };

  cancel = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const { reason } = cancelSchema.parse(req.body ?? {});
    res.json({ appointment: await this.appointments.cancel(getAuthUser(req), id, reason) });
  };
}
