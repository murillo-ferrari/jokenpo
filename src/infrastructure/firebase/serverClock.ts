import { onValue, ref, type Database } from 'firebase/database';
import type { Clock, Unsubscribe } from '../../application/ports';

/**
 * Horário do servidor estimado a partir do relógio local mais a diferença que o Firebase mede.
 * Os prazos do jogo (W.O., vaga abandonada) comparam com horários gravados pelo servidor,
 * então um relógio local adiantado ou atrasado não pode interferir.
 */
export class FirebaseServerClock implements Clock {
  private offset = 0;
  private readonly stop: Unsubscribe;

  constructor(db: Database) {
    this.stop = onValue(ref(db, '.info/serverTimeOffset'), (snapshot) => {
      const value: unknown = snapshot.val();
      this.offset = typeof value === 'number' ? value : 0;
    });
  }

  now(): number {
    return Date.now() + this.offset;
  }

  dispose(): void {
    this.stop();
  }
}
