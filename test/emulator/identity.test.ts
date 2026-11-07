import { describe, expect, it } from 'vitest';
import { createFirebaseClient } from '../../src/infrastructure/firebase/client';
import { FirebaseIdentity } from '../../src/infrastructure/firebase/identity';

/* Login anônimo de verdade, no emulador de Auth. Rode com `npm run test:emulator`. */

describe('FirebaseIdentity', () => {
  const { auth } = createFirebaseClient({ VITE_USE_EMULATORS: 'true' });
  const identity = new FirebaseIdentity(auth);

  it('cria um jogador anônimo na primeira chamada', async () => {
    const playerId = await identity.ensurePlayer();
    expect(playerId).toMatch(/\S+/);
    expect(auth.currentUser?.isAnonymous).toBe(true);
  });

  it('devolve o mesmo jogador nas chamadas seguintes, sem criar outro', async () => {
    const first = await identity.ensurePlayer();
    const second = await identity.ensurePlayer();
    expect(second).toBe(first);
  });
});
