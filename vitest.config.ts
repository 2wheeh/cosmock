import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    globalSetup: './test/global-setup.ts',
  },
})
