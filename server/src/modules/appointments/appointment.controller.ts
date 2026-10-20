import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppointmentStatus } from '../../domain/enums';
import { getAuthUser } from '../../middleware/authenticate';
import { dateString, id, optionalText } from '../../validation';
import type { AppointmentService } from './appointment.service';
import type { BookingService } from './booking.service';

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

const noteSchema = z.object({
  content: z.string('NOTE_REQUIRED').trim().min(1, 'NOTE_REQUIRED').max(1000, 'NOTE_TOO_LONG'),
});

/** Staff list: a day (UC-R1) and/or a search by code or phone (UC-R2), plus optional filters. */
const staffListQuery = z
  .object({
    date: dateString().optional(),
    shiftId: id().optional(),
    specialtyId: id().optional(),
    doctorId: id().optional(),
    status: z.enum(AppointmentStatus, 'STATUS_INVALID').optional(),
    q: optionalText(50, 'QUERY_TOO_LONG'),
  })
  .refine((q) => q.date !== undefined || q.q !== undefined, {
    error: 'DATE_OR_QUERY_REQUIRED',
    path: ['date'],
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

  listForStaff = async (req: Request, res: Response) => {
    const { q, ...filter } = staffListQuery.parse(req.query);
    res.json(await this.appointments.listForStaff(getAuthUser(req), { ...filter, query: q }));
  };

  cancel = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const { reason } = cancelSchema.parse(req.body ?? {});
    res.json({ appointment: await this.appointments.cancel(getAuthUser(req), id, reason) });
  };

  checkIn = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ appointment: await this.appointments.checkIn(getAuthUser(req), id) });
  };

  markNoShow = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ appointment: await this.appointments.markNoShow(getAuthUser(req), id) });
  };

  start = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ appointment: await this.appointments.start(getAuthUser(req), id) });
  };

  complete = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ appointment: await this.appointments.complete(getAuthUser(req), id) });
  };

  addNote = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const { content } = noteSchema.parse(req.body ?? {});
    res
      .status(201)
      .json({ appointment: await this.appointments.addNote(getAuthUser(req), id, content) });
  };
}
