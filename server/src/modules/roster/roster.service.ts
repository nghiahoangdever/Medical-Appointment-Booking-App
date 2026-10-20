import { appClock } from '../../clock';
import { runInTransaction, type Db } from '../../db/prisma';
import { usesCapacity } from '../../domain/booking';
import { conflict, notFound, type AppError } from '../../domain/errors';
import {
  capacityFailure,
  deleteFailure,
  rosterDateFailure,
  rosterPermissions,
  type RosterEntryFacts,
} from '../../domain/rosterRules';
import { addDays, systemClock, type Clock } from '../../domain/time';
import { doctorRepository, type DoctorRepository } from '../doctors/doctor.repository';
import { roomRepository, type RoomRepository } from '../rooms/room.repository';
import { shiftRepository, type ShiftRepository } from '../shifts/shift.repository';
import {
  rosterRepository,
  type AdminRosterEntry,
  type NewRosterEntry,
  type RosterRepository,
} from './roster.repository';

function entryFacts(e: AdminRosterEntry): RosterEntryFacts {
  return {
    date: e.date,
    activeCount: e.appointmentStatuses.filter(usesCapacity).length,
    appointmentCount: e.appointmentStatuses.length,
  };
}

/** A roster entry for the admin editor, with counts and what may be done with it. */
function toEntryView(e: AdminRosterEntry, now: Date) {
  const facts = entryFacts(e);
  const { appointmentStatuses: _, ...entry } = e;
  return {
    ...entry,
    activeCount: facts.activeCount,
    appointmentCount: facts.appointmentCount,
    ...rosterPermissions(facts, now),
  };
}

export interface SkippedCopy {
  sourceEntryId: number;
  date: string;
  shiftId: number;
  roomId: number;
  doctorName: string;
  /** Error code explaining why it was not copied. */
  reason: string;
}

/** UC-A6 / UC-A7: the weekly duty roster. */
export class RosterService {
  constructor(
    private readonly roster: RosterRepository,
    private readonly doctors: DoctorRepository,
    private readonly rooms: RoomRepository,
    private readonly shifts: ShiftRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** The week starting on `weekStart` (a Monday): entries plus the rooms/doctors for the grid. */
  async getWeek(weekStart: string) {
    const now = this.clock();
    const weekEnd = addDays(weekStart, 6);
    const [entries, rooms, shifts, doctors] = await Promise.all([
      this.roster.findForWeek(weekStart, weekEnd),
      this.rooms.findAll(),
      this.shifts.findAll(),
      this.doctors.findAllAccounts(),
    ]);
    const usedRoomIds = new Set(entries.map((e) => e.roomId));
    return {
      weekStart,
      weekEnd,
      // `editable`: entries can be added/changed on this day (not in the past).
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, editable: rosterDateFailure(date, now) === null };
      }),
      shifts: shifts.map(({ id, name, startTime, endTime }) => ({ id, name, startTime, endTime })),
      // Inactive rooms only appear when they still have entries this week.
      rooms: rooms.filter((r) => r.isActive || usedRoomIds.has(r.id)),
      doctors: doctors
        .filter((d) => d.user.isActive)
        .map((d) => ({
          id: d.id,
          fullName: d.user.fullName,
          title: d.title,
          specialty: { id: d.specialty.id, name: d.specialty.name },
        })),
      entries: entries.map((e) => toEntryView(e, now)),
    };
  }

  /** Adds a doctor to a room for a date + shift. */
  async createEntry(input: NewRosterEntry) {
    const now = this.clock();
    const pastDate = rosterDateFailure(input.date, now);
    if (pastDate) throw pastDate;
    const entry = await runInTransaction(async (tx) => {
      const failure = await this.placementFailure(input, tx);
      if (failure) throw failure;
      return this.roster.create(input, tx);
    });
    return toEntryView(entry, now);
  }

  /** Moves an entry to another room and/or changes its capacity (doctor, date and shift are fixed). */
  async updateEntry(id: number, changes: { roomId?: number; maxPatients?: number }) {
    const now = this.clock();
    const entry = await runInTransaction(async (tx) => {
      const current = await this.requireEntry(id, tx);
      const facts = entryFacts(current);
      const pastDate = rosterDateFailure(current.date, now);
      if (pastDate) throw pastDate;
      if (changes.maxPatients !== undefined) {
        const tooSmall = capacityFailure(facts, changes.maxPatients);
        if (tooSmall) throw tooSmall;
      }
      if (changes.roomId !== undefined && changes.roomId !== current.roomId) {
        const failure =
          (await this.roomFailure(changes.roomId, tx)) ??
          (await this.slotTaken(
            { roomId: changes.roomId, date: current.date, shiftId: current.shiftId },
            tx,
            'ROSTER_ROOM_CONFLICT',
          ));
        if (failure) throw failure;
      }
      return this.roster.update(id, changes, tx);
    });
    return toEntryView(entry, now);
  }

  /** Removes an entry that nobody has booked. */
  async deleteEntry(id: number) {
    const now = this.clock();
    await runInTransaction(async (tx) => {
      const current = await this.requireEntry(id, tx);
      const blocked = deleteFailure(entryFacts(current), now);
      if (blocked) throw blocked;
      await this.roster.delete(id, tx);
    });
  }

  /**
   * UC-A7: copies the previous week's entries into the week starting `weekStart`, same weekday,
   * shift, room, doctor and capacity. Entries that can't be placed are skipped with a reason
   * (past date, inactive doctor/room, doctor or room already taken); the rest are created in one
   * transaction.
   */
  async copyPreviousWeek(weekStart: string) {
    const now = this.clock();
    const sourceStart = addDays(weekStart, -7);
    return runInTransaction(async (tx) => {
      const source = await this.roster.findForWeek(sourceStart, addDays(sourceStart, 6), tx);
      let created = 0;
      const skipped: SkippedCopy[] = [];
      for (const entry of source) {
        const target: NewRosterEntry = {
          doctorId: entry.doctor.id,
          roomId: entry.roomId,
          shiftId: entry.shiftId,
          date: addDays(entry.date, 7),
          maxPatients: entry.maxPatients,
        };
        const failure =
          rosterDateFailure(target.date, now) ?? (await this.placementFailure(target, tx));
        if (failure) {
          skipped.push({
            sourceEntryId: entry.id,
            date: target.date,
            shiftId: target.shiftId,
            roomId: target.roomId,
            doctorName: entry.doctor.fullName,
            reason: failure.code,
          });
          continue;
        }
        await this.roster.create(target, tx);
        created++;
      }
      return { sourceWeekStart: sourceStart, created, skipped };
    });
  }

  /**
   * Why a new entry can't be placed, or null: doctor and room must exist and be active, the shift
   * must exist, and neither the doctor nor the room may already be on the roster for that slot.
   */
  private async placementFailure(input: NewRosterEntry, db: Db): Promise<AppError | null> {
    const doctor = await this.doctors.findAccountById(input.doctorId, db);
    if (!doctor) return notFound('DOCTOR_NOT_FOUND', `Doctor ${input.doctorId} not found`);
    if (!doctor.user.isActive) return conflict('DOCTOR_INACTIVE', 'This doctor is deactivated');
    const roomFailure = await this.roomFailure(input.roomId, db);
    if (roomFailure) return roomFailure;
    if (!(await this.shifts.findById(input.shiftId, db))) {
      return notFound('SHIFT_NOT_FOUND', `Shift ${input.shiftId} not found`);
    }
    const slot = { date: input.date, shiftId: input.shiftId };
    return (
      (await this.slotTaken({ ...slot, doctorId: input.doctorId }, db, 'ROSTER_DOCTOR_CONFLICT')) ??
      (await this.slotTaken({ ...slot, roomId: input.roomId }, db, 'ROSTER_ROOM_CONFLICT'))
    );
  }

  private async roomFailure(roomId: number, db: Db): Promise<AppError | null> {
    const room = await this.rooms.findById(roomId, db);
    if (!room) return notFound('ROOM_NOT_FOUND', `Room ${roomId} not found`);
    if (!room.isActive) return conflict('ROOM_INACTIVE', 'This room is deactivated');
    return null;
  }

  private async slotTaken(
    slot: { doctorId?: number; roomId?: number; date: string; shiftId: number },
    db: Db,
    code: 'ROSTER_DOCTOR_CONFLICT' | 'ROSTER_ROOM_CONFLICT',
  ): Promise<AppError | null> {
    const taken = await this.roster.findBySlot(slot, db);
    return taken
      ? conflict(
          code,
          code === 'ROSTER_DOCTOR_CONFLICT'
            ? 'The doctor is already on duty in this shift'
            : 'The room is already taken in this shift',
        )
      : null;
  }

  private async requireEntry(id: number, db: Db): Promise<AdminRosterEntry> {
    const entry = await this.roster.findAdminEntry(id, db);
    if (!entry) throw notFound('ROSTER_ENTRY_NOT_FOUND', `Roster entry ${id} not found`);
    return entry;
  }
}

export const rosterService = new RosterService(
  rosterRepository,
  doctorRepository,
  roomRepository,
  shiftRepository,
  appClock,
);
