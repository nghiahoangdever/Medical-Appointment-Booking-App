import { PrismaClient, type Prisma } from '@prisma/client';

// Single shared client; only repositories (and runInTransaction) should import this.
// DATABASE_URL sets connection_limit=1: SQLite allows one writer at a time anyway, and a
// single connection makes each interactive transaction run alone, so bookings can't interleave.
export const prisma = new PrismaClient();

/** The client or a transaction; repository methods accept either. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Runs `work` atomically. Services use this to group several repository calls. */
export function runInTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(work, { maxWait: 5_000, timeout: 10_000 });
}
