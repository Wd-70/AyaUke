import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Next preserves JSX for its own compiler; Node component tests need it transformed.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
