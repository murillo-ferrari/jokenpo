import { useEffect, useState } from 'preact/hooks';
import type { Identity } from '../application/ports';

type Connection =
  | { status: 'connecting' }
  | { status: 'ready'; playerId: string }
  | { status: 'error'; message: string };

interface AppProps {
  identity: Identity;
}

/**
 * Tela provisória da Fase 1: só confirma que o login anônimo funciona.
 * As telas do jogo (Início, Esperando, Jogo) chegam na Fase 4.
 */
export function App({ identity }: AppProps) {
  const [connection, setConnection] = useState<Connection>({ status: 'connecting' });

  useEffect(() => {
    identity
      .ensurePlayer()
      .then((playerId) => setConnection({ status: 'ready', playerId }))
      .catch((error: unknown) =>
        setConnection({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
      );
  }, [identity]);

  return (
    <main>
      <h1>Jokenpô Online</h1>
      <p>Nova versão em construção.</p>
      <p role="status">
        {connection.status === 'connecting' && 'Conectando…'}
        {connection.status === 'ready' && `Conectado como ${connection.playerId.slice(0, 6)}…`}
        {connection.status === 'error' && `Erro ao conectar: ${connection.message}`}
      </p>
    </main>
  );
}
