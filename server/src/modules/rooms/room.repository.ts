import { prisma, type Db } from '../../db/prisma';

export interface RoomData {
  code: string;
  name: string;
  floor: string | null;
}

export class RoomRepository {
  findAll() {
    return prisma.room.findMany({ orderBy: { code: 'asc' } });
  }

  findById(id: number, db: Db = prisma) {
    return db.room.findUnique({ where: { id } });
  }

  findByCode(code: string) {
    return prisma.room.findUnique({ where: { code } });
  }

  create(data: RoomData) {
    return prisma.room.create({ data });
  }

  update(id: number, data: Partial<RoomData> & { isActive?: boolean }) {
    return prisma.room.update({ where: { id }, data });
  }
}

export const roomRepository = new RoomRepository();
