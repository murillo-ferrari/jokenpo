import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serve o site em /jokenpo/.
  base: '/jokenpo/',
  plugins: [preact()],
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // Testes de integração precisam dos emuladores: rodam com `npm run test:emulator`.
    exclude: ['test/emulator/**'],
  },
});
