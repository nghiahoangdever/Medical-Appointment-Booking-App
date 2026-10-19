import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    // Tests run against a separate SQLite file (prisma/test.db), never dev.db.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db?connection_limit=1',
      JWT_SECRET: 'test-secret',
    },
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
