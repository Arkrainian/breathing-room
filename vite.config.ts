import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The site is served from https://<user>.github.io/breathing-room/, so assets need that prefix.
export default defineConfig({
  base: '/breathing-room/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
