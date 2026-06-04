import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: '../..',
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 15000,
  },
})
