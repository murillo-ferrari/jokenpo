import { render } from 'preact';
import { GameSession } from './application/gameSession';
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
  const session = new GameSession({
    identity: new FirebaseIdentity(firebase.auth),
    gateway: new FirebaseRoomGateway(firebase.database),
    clock: new FirebaseServerClock(firebase.database),
    random: cryptoRandom,
    store: new LocalSessionStore(),
  });
  render(<App session={session} language={language} />, root);
  session.start(takeInviteCode()).catch((error: unknown) => {
    console.error('Falha ao iniciar a sessão', error);
    render(<StartupError language={language} />, root);
  });
} catch (error) {
  console.error('Falha ao iniciar o jogo', error);
  render(<StartupError language={language} />, root);
}
