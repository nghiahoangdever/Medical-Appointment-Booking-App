import type { Request, Response } from 'express';
import { z } from 'zod';
import { email, fullName, id, nullableText, password, phone } from '../../validation';
import type { StaffService } from './staff.service';

const params = z.object({ id: id() });

const accountSchema = z.object({
  fullName: fullName(),
  email: email(),
  phone: phone(),
  password: password(),
});

const doctorProfile = {
  title: z.string().trim().min(1, 'TITLE_REQUIRED').max(50, 'TITLE_TOO_LONG'),
  bio: nullableText(500, 'BIO_TOO_LONG'),
};

const createDoctorSchema = accountSchema.extend({
  specialtyId: id(),
  title: doctorProfile.title,
  bio: doctorProfile.bio.optional(),
});

// Everything optional on update; specialtyId can't change. A password resets it.
const updateAccountSchema = accountSchema.partial();
const updateDoctorSchema = updateAccountSchema.extend({
  title: doctorProfile.title.optional(),
  bio: doctorProfile.bio.optional(),
});

/** UC-A3 / UC-A4 (admin only). */
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  listDoctors = async (_req: Request, res: Response) => {
    res.json({ doctors: await this.staff.listDoctors() });
  };

  createDoctor = async (req: Request, res: Response) => {
    const input = createDoctorSchema.parse(req.body ?? {});
    res
      .status(201)
      .json({ doctor: await this.staff.createDoctor({ ...input, bio: input.bio ?? undefined }) });
  };

  updateDoctor = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const changes = updateDoctorSchema.parse(req.body ?? {});
    res.json({ doctor: await this.staff.updateDoctor(id, changes) });
  };

  activateDoctor = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ doctor: await this.staff.setDoctorActive(id, true) });
  };

  deactivateDoctor = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ doctor: await this.staff.setDoctorActive(id, false) });
  };

  listReceptionists = async (_req: Request, res: Response) => {
    res.json({ receptionists: await this.staff.listReceptionists() });
  };

  createReceptionist = async (req: Request, res: Response) => {
    const input = accountSchema.parse(req.body ?? {});
    res.status(201).json({ receptionist: await this.staff.createReceptionist(input) });
  };

  updateReceptionist = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    const changes = updateAccountSchema.parse(req.body ?? {});
    res.json({ receptionist: await this.staff.updateReceptionist(id, changes) });
  };

  activateReceptionist = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ receptionist: await this.staff.setReceptionistActive(id, true) });
  };

  deactivateReceptionist = async (req: Request, res: Response) => {
    const { id } = params.parse(req.params);
    res.json({ receptionist: await this.staff.setReceptionistActive(id, false) });
  };
}
