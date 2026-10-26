import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/balance/**'],
    // Several core tests walk large random tables; under parallel workers they can exceed Vitest's 5 s default.
    testTimeout: 20_000,
  },
});
