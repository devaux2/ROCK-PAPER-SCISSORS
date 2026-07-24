import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    // Match/timer tests manipulate fake timers; keep files isolated.
    fileParallelism: false,
  },
});
