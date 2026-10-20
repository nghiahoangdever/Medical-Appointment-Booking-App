import { appClock } from '../../clock';
import { conflict, notFound } from '../../domain/errors';
import { systemClock, today, type Clock } from '../../domain/time';
import {
  appointmentRepository,
  type AppointmentRepository,
} from '../appointments/appointment.repository';
import { roomRepository, type RoomData, type RoomRepository } from './room.repository';

/** UC-A2: manage rooms. */
export class RoomService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  list() {
    return this.rooms.findAll();
  }

  async create(data: RoomData) {
    await this.ensureCodeFree(data.code);
    return this.rooms.create(data);
  }

  async update(id: number, data: Partial<RoomData>) {
    await this.require(id);
    if (data.code !== undefined) await this.ensureCodeFree(data.code, id);
    return this.rooms.update(id, data);
  }

  /**
   * Inactive rooms can't be put on the roster and their entries stop taking bookings.
   * Blocked while appointments from today on are still open in the room.
   */
  async setActive(id: number, isActive: boolean) {
    await this.require(id);
    if (!isActive) {
      const open = await this.appointments.countUpcomingOpen({ roomId: id }, today(this.clock()));
      if (open > 0) {
        throw conflict('HAS_UPCOMING_APPOINTMENTS', `${open} upcoming appointments are still open`);
      }
    }
    return this.rooms.update(id, { isActive });
  }

  private async require(id: number) {
    const room = await this.rooms.findById(id);
    if (!room) throw notFound('ROOM_NOT_FOUND', `Room ${id} not found`);
    return room;
  }

  private async ensureCodeFree(code: string, exceptId?: number) {
    const existing = await this.rooms.findByCode(code);
    if (existing && existing.id !== exceptId) {
      throw conflict('ROOM_CODE_TAKEN', `Room code ${code} already exists`);
    }
  }
}

export const roomService = new RoomService(roomRepository, appointmentRepository, appClock);
