import { render } from 'preact';
import { GameSession } from './application/gameSession';
import { startComputerGame } from './computerGame';
import { cryptoRandom } from './infrastructure/browser/cryptoRandom';
import { LocalSessionStore } from './infrastructure/browser/localSessionStore';
import { createFirebaseClient } from './infrastructure/firebase/client';
import { FirebaseIdentity } from './infrastructure/firebase/identity';
import { FirebaseRoomGateway } from './infrastructure/firebase/roomGateway';
import { FirebaseServerClock } from './infrastructure/firebase/serverClock';
import { App, StartupError } from './ui/App';
import { loadLanguage } from './ui/i18n';
import { takeInviteCode } from './ui/invite';
import './ui/styles/tokens.css';
import './ui/styles/app.css';

// Composition root: único lugar que liga a infraestrutura à aplicação e à UI.
const root = document.getElementById('app');
if (!root) throw new Error('Elemento #app não encontrado no index.html.');
const language = loadLanguage();

try {
  const firebase = createFirebaseClient(import.meta.env);
  const store = new LocalSessionStore();
  const session = new GameSession({
    identity: new FirebaseIdentity(firebase.auth),
    gateway: new FirebaseRoomGateway(firebase.database),
    clock: new FirebaseServerClock(firebase.database),
    random: cryptoRandom,
    store,
  });
  render(
    <App session={session} language={language} startComputerGame={(bestOf) => startComputerGame(bestOf, store.loadNickname())} />,
    root,
  );
  // Falhas de conexão viram aviso na tela inicial (ver GameSession.start); aqui só registramos.
  session.start(takeInviteCode()).catch((error: unknown) => console.error('Falha ao iniciar a sessão', error));
  registerServiceWorker();
} catch (error) {
  console.error('Falha ao iniciar o jogo', error);
  render(<StartupError language={language} />, root);
}

/** Service worker só no build de produção: em desenvolvimento ele atrapalharia o recarregamento. */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.warn('Service worker não registrado', error);
    });
  });
}
