// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startComputerGame } from '../src/computerGame';
import { App } from '../src/ui/App';
import { FakeServer, createPlayer, settle, type TestPlayer } from './support/fakeServer';

/*
 * Telas renderizadas de verdade (num DOM simulado), ligadas ao GameSession
 * com o servidor em memória. Cada teste usa só o que o usuário vê: textos, papéis e rótulos.
 */

let server: FakeServer;

beforeEach(() => {
  server = new FakeServer();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

async function renderPlayer(player: TestPlayer, language: 'pt-BR' | 'en' = 'pt-BR') {
  render(
    <App
      session={player.session}
      language={language}
      startComputerGame={(bestOf) => startComputerGame(bestOf, null, { thinkingMs: [10, 20] })}
    />,
  );
  await player.session.start();
  await settle();
}

/** Alice (renderizada) cria a sala; Bob (só sessão) entra. */
async function startRenderedGame() {
  const alice = createPlayer(server, 'alice');
  await renderPlayer(alice);
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  await settle();
  const code = screen.getByText(/^[A-HJKMNP-Z2-9]{4}$/).textContent ?? '';
  const bob = createPlayer(server, 'bob');
  await bob.session.start();
  await bob.session.joinRoom(code);
  await settle();
  return { alice, bob, code };
}

describe('tela inicial', () => {
  it('mostra criar sala e o campo do código, em pt-BR por padrão', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeTruthy();
    expect(screen.getByLabelText('Código da sala')).toBeTruthy();
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('código inválido mostra o erro junto do campo, sem alert()', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    const input = screen.getByLabelText('Código da sala');
    fireEvent.input(input, { target: { value: 'AB.C' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('Use só letras e números');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('trocar para inglês muda os textos e o lang da página, e a escolha fica salva', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Create room' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('jokenpo:language')).toBe('en');
  });
});

describe('espera e jogo', () => {
  it('quem cria a sala vê o código e o botão de sair', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await settle();
    expect(screen.getByText('Esperando o adversário entrar…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair da sala' })).toBeTruthy();
  });

  it('com o adversário na sala, aparecem as jogadas e um aviso', async () => {
    await startRenderedGame();
    expect(screen.getByRole('group', { name: 'Sua jogada' })).toBeTruthy();
    expect(screen.getByText('O adversário entrou. Boa partida!')).toBeTruthy();
  });

  it('escolher uma jogada marca o botão e bloqueia os outros', async () => {
    await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Pedra' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Pedra' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: 'Papel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Você escolheu Pedra/)).toBeTruthy();
  });

  it('depois da rodada, o placar e o resultado aparecem', async () => {
    const { bob } = await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await bob.session.play('rock');
    await settle();
    expect(screen.getByLabelText('Placar: você 1, adversário 0, 0 empates.')).toBeTruthy();
    // Espera a contagem "Jo… Ken… Pô!" terminar.
    await waitFor(() => expect(screen.getByText('Você venceu!')).toBeTruthy(), { timeout: 3000 });
  });

  it('pedido de reset do adversário abre um diálogo para aceitar ou recusar', async () => {
    const { bob } = await startRenderedGame();
    await bob.session.requestReset();
    await settle();
    expect(screen.getByRole('dialog', { name: 'Recomeçar a partida?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar como está' }));
    await settle();
    expect(screen.queryByRole('dialog', { name: 'Recomeçar a partida?' })).toBeNull();
  });

  it('sair durante o jogo pede confirmação', async () => {
    await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeTruthy();
  });
});

describe('fase 5: formato, apelido e computador', () => {
  it('o formato escolhido vale para a sala criada e aparece no placar', async () => {
    const alice = createPlayer(server, 'alice');
    await renderPlayer(alice);
    fireEvent.click(screen.getByRole('radio', { name: 'Melhor de 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await settle();
    const code = screen.getByText(/^[A-HJKMNP-Z2-9]{4}$/).textContent ?? '';
    const bob = createPlayer(server, 'bob');
    await bob.session.start();
    await bob.session.joinRoom(code);
    await settle();
    expect(screen.getByText('Melhor de 3 · vence quem fizer 2')).toBeTruthy();
    expect(localStorage.getItem('jokenpo:best-of')).toBe('3');
  });

  it('o apelido digitado é salvo e aparece para o adversário', async () => {
    const alice = createPlayer(server, 'alice');
    await renderPlayer(alice);
    const input = screen.getByLabelText('Seu apelido (opcional)');
    fireEvent.input(input, { target: { value: 'Alice' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await settle();
    const code = screen.getByText(/^[A-HJKMNP-Z2-9]{4}$/).textContent ?? '';
    const bob = createPlayer(server, 'bob');
    await bob.session.start();
    await bob.session.joinRoom(code);
    await settle();
    expect(bob.view()).toMatchObject({ opponentName: 'Alice' });
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('jogar contra o computador abre o jogo direto e sair volta para o início', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    fireEvent.click(screen.getByRole('button', { name: 'Jogar contra o computador' }));
    await waitFor(() => expect(screen.getByText('Contra o computador')).toBeTruthy());
    expect(screen.getByText('Computador')).toBeTruthy();
    expect(screen.queryByText('O adversário entrou. Boa partida!')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar sala' })).toBeTruthy());
  });

  it('o adversário aparece como online', async () => {
    await startRenderedGame();
    expect(screen.getByText('online')).toBeTruthy();
  });

  it('fim de partida mostra o vencedor e o botão de revanche', async () => {
    const alice = createPlayer(server, 'alice');
    await renderPlayer(alice);
    fireEvent.click(screen.getByRole('radio', { name: 'Melhor de 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await settle();
    const code = screen.getByText(/^[A-HJKMNP-Z2-9]{4}$/).textContent ?? '';
    const bob = createPlayer(server, 'bob');
    await bob.session.start();
    await bob.session.joinRoom(code);
    await settle();
    for (let i = 0; i < 2; i += 1) {
      await alice.session.play('rock');
      await bob.session.play('scissors');
      await settle();
    }
    expect(screen.getByText('🏆 Você venceu a partida!')).toBeTruthy();
    expect(screen.getByText('Placar final: 2 × 0')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revanche' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Sua jogada' })).toBeNull();
  });
});
