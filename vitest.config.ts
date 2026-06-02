import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      chalk: new URL('./src/test/chalk-shim.ts', import.meta.url).pathname
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', '**/*.test.ts', '**/*.config.ts', '**/*.d.ts', 'dist/**']
    }
  }
});
