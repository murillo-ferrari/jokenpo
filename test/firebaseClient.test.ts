import { describe, expect, it } from 'vitest';
import { readFirebaseOptions } from '../src/infrastructure/firebase/client';

const COMPLETE_ENV = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'jokenpo.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://jokenpo.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'jokenpo',
  VITE_FIREBASE_APP_ID: 'app',
};

describe('readFirebaseOptions', () => {
  it('monta a config a partir das variáveis VITE_FIREBASE_*', () => {
    expect(readFirebaseOptions(COMPLETE_ENV)).toEqual({
      apiKey: 'key',
      authDomain: 'jokenpo.firebaseapp.com',
      databaseURL: 'https://jokenpo.firebaseio.com',
      projectId: 'jokenpo',
      appId: 'app',
    });
  });

  it('lista todas as variáveis que faltam', () => {
    expect(() => readFirebaseOptions({ VITE_FIREBASE_API_KEY: 'key' })).toThrow(
      /VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_URL, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID/,
    );
  });

  it('com emuladores, usa o projeto demo e dispensa credenciais', () => {
    const options = readFirebaseOptions({ VITE_USE_EMULATORS: 'true' });
    expect(options.projectId).toBe('demo-jokenpo');
    expect(options.databaseURL).toContain('127.0.0.1:9000');
  });
});
