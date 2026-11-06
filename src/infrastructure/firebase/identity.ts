import { signInAnonymously, type Auth } from 'firebase/auth';
import type { Identity } from '../../application/ports';
import { toPlayerId, type PlayerId } from '../../domain/types';

/**
 * Identidade via Auth anônima do Firebase. O SDK guarda a sessão no navegador
 * (IndexedDB), então o mesmo uid volta depois de um F5.
 */
export class FirebaseIdentity implements Identity {
  constructor(private readonly auth: Auth) {}

  async ensurePlayer(): Promise<PlayerId> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser ?? (await signInAnonymously(this.auth)).user;
    return toPlayerId(user.uid);
  }
}
