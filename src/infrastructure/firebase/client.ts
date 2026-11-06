import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  database: Database;
}

/** Projeto "demo-*": o emulador aceita sem credenciais reais. */
const EMULATOR_PROJECT_ID = 'demo-jokenpo';
const EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR_PORT = 9099;
const DATABASE_EMULATOR_PORT = 9000;

type Env = Record<string, string | undefined>;

const REQUIRED_KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  databaseURL: 'VITE_FIREBASE_DATABASE_URL',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const satisfies Partial<Record<keyof FirebaseOptions, string>>;

export function usesEmulators(env: Env): boolean {
  return env.VITE_USE_EMULATORS === 'true';
}

/** Monta a config do Firebase a partir das variáveis `VITE_FIREBASE_*`. */
export function readFirebaseOptions(env: Env): FirebaseOptions {
  if (usesEmulators(env)) {
    return {
      apiKey: 'demo-api-key',
      projectId: EMULATOR_PROJECT_ID,
      databaseURL: `http://${EMULATOR_HOST}:${DATABASE_EMULATOR_PORT}?ns=${EMULATOR_PROJECT_ID}`,
    };
  }

  const missing = Object.values(REQUIRED_KEYS).filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Configuração do Firebase incompleta. Faltam: ${missing.join(', ')}. ` +
        'Copie .env.example para .env.local, ou use VITE_USE_EMULATORS=true.',
    );
  }

  const options: FirebaseOptions = {};
  for (const [option, key] of Object.entries(REQUIRED_KEYS)) {
    options[option as keyof typeof REQUIRED_KEYS] = env[key];
  }
  return options;
}

export function createFirebaseClient(env: Env): FirebaseClient {
  const app = initializeApp(readFirebaseOptions(env));
  const auth = getAuth(app);
  const database = getDatabase(app);

  if (usesEmulators(env)) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true });
    connectDatabaseEmulator(database, EMULATOR_HOST, DATABASE_EMULATOR_PORT);
  }

  return { app, auth, database };
}
