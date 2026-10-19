import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

/** Recreates prisma/test.db from the migrations once per test run. */
export default function setup() {
  const serverDir = process.cwd();
  const dbFile = path.join(serverDir, 'prisma', 'test.db');
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

  execSync('npx prisma migrate deploy', {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
}
