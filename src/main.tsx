import { render } from 'preact';
import { createFirebaseClient } from './infrastructure/firebase/client';
import { FirebaseIdentity } from './infrastructure/firebase/identity';
import { App } from './ui/App';

// Composition root: único lugar que liga a infraestrutura à aplicação e à UI.
const firebase = createFirebaseClient(import.meta.env);
const identity = new FirebaseIdentity(firebase.auth);

const root = document.getElementById('app');
if (!root) throw new Error('Elemento #app não encontrado no index.html.');

render(<App identity={identity} />, root);
