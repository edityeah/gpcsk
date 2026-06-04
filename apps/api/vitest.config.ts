import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  envDir: '../..',
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 15000,
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
  },
})
