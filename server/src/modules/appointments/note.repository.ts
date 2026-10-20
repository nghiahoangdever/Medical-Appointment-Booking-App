import { prisma } from '../../db/prisma';

export interface NewNote {
  appointmentId: number;
  authorId: number;
  content: string;
  createdAt: Date;
}

/** AppointmentNote: internal staff notes on an appointment. */
export class NoteRepository {
  create(data: NewNote) {
    return prisma.appointmentNote.create({ data });
  }
}

export const noteRepository = new NoteRepository();
