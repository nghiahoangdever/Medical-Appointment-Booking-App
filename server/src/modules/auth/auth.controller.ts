import type { Request, Response } from 'express';
import { z } from 'zod';
import { Gender } from '../../domain/enums';
import { today } from '../../domain/time';
import { getAuthUser } from '../../middleware/authenticate';
import { dateString, email, fullName, password, phone } from '../../validation';
import type { AuthService } from './auth.service';

const registerSchema = z.object({
  fullName: fullName(),
  email: email(),
  phone: phone(),
  password: password(),
  dateOfBirth: dateString().refine((d) => d <= today(), 'DATE_OF_BIRTH_IN_FUTURE'),
  gender: z.enum(Gender, 'GENDER_INVALID'),
  address: z.string().trim().max(200, 'ADDRESS_TOO_LONG').optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'IDENTIFIER_REQUIRED'),
  password: z.string().min(1, 'PASSWORD_REQUIRED'),
});

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response) => {
    const input = registerSchema.parse(req.body);
    res.status(201).json(await this.auth.registerPatient(input));
  };

  login = async (req: Request, res: Response) => {
    const { identifier, password } = loginSchema.parse(req.body);
    res.json(await this.auth.login(identifier, password));
  };

  me = async (req: Request, res: Response) => {
    const user = await this.auth.getCurrentUser(getAuthUser(req).id);
    res.json({ user });
  };
}
