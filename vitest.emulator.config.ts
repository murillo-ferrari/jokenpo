import { defineConfig } from 'vitest/config';

// Executado por `npm run test:emulator`, dentro de `firebase emulators:exec`.
export default defineConfig({
  test: {
    include: ['test/emulator/**/*.test.ts'],
    // Todos os testes usam o mesmo emulador: rodar em sequência evita interferência.
    fileParallelism: false,
  },
});
