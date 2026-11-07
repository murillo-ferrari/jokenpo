// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startComputerGame } from '../src/computerGame';
import { commitFor } from '../src/domain/commitment';
import { ConfirmDialog } from '../src/ui/components/ConfirmDialog';
import { RESULT_HOLD_MS } from '../src/ui/hooks/useRevealSequence';
import { App } from '../src/ui/App';
import { FakeServer, OfflineableGateway, createPlayer, settle, type TestPlayer } from './support/fakeServer';

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

/** O cartão do centro e o que ele mostra. */
const card = () => document.querySelector('.round-card') as HTMLElement;
const cardText = () => card().textContent ?? '';
const cardResult = () => card().querySelector('.round-result')?.textContent?.trim() ?? '';

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

describe('sem rede', () => {
  it('com a sala salva sem resposta ("Conectando…"), o jogo contra o computador continua disponível', async () => {
    const gateway = new OfflineableGateway(server, 'alice' as never);
    const alice = createPlayer(server, 'alice', { gateway, connectTimeoutMs: 60_000 });
    alice.store.room = 'AB23' as never;
    render(
      <App
        session={alice.session}
        language="pt-BR"
        startComputerGame={(bestOf) => startComputerGame(bestOf, null, { thinkingMs: [10, 20] })}
      />,
    );
    void alice.session.start();
    await settle();

    expect(screen.getByText('Conectando…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Criar sala' }) as HTMLButtonElement).disabled).toBe(true);
    const computer = screen.getByRole('button', { name: 'Jogar contra o computador' }) as HTMLButtonElement;
    expect(computer.disabled).toBe(false);

    fireEvent.click(computer);
    await waitFor(() => expect(screen.getByText('Contra o computador')).toBeTruthy());
  });

  it('quando a conexão não responde a tempo, aparece o aviso com a saída pelo computador', async () => {
    const gateway = new OfflineableGateway(server, 'alice' as never);
    const alice = createPlayer(server, 'alice', { gateway, connectTimeoutMs: 30 });
    alice.store.room = 'AB23' as never;
    await renderPlayer(alice);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não deu para conectar'));
  });
});

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

  it('o campo do código aceita no máximo 4 caracteres, em maiúsculas, sem espaços nem hífens', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    const input = screen.getByLabelText('Código da sala') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'abcde' } });
    expect(input.value).toBe('ABCD');
    fireEvent.input(input, { target: { value: 'ab-23' } }); // colado com hífen
    expect(input.value).toBe('AB23');
    fireEvent.input(input, { target: { value: ' a b 2 3 9 ' } });
    expect(input.value).toBe('AB23');
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

  it('o placar só muda depois da contagem "Jo… Ken… Pô!", junto com as jogadas', async () => {
    const { bob } = await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await bob.session.play('rock');
    await settle();

    // Durante a contagem: placar ainda zerado, nenhuma jogada à mostra, botões travados.
    expect(screen.getByLabelText('Placar: você 0, adversário 0, 0 empates.')).toBeTruthy();
    expect(screen.getByText('Jo…')).toBeTruthy();
    expect(cardResult()).toBe('');
    expect((screen.getByRole('button', { name: 'Pedra' }) as HTMLButtonElement).disabled).toBe(true);

    // Fim da contagem: placar e resultado aparecem juntos.
    await waitFor(() => expect(cardResult()).toBe('Você venceu!'), { timeout: 3000 });
    expect(screen.getByLabelText('Placar: você 1, adversário 0, 0 empates.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Pedra' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('com movimento reduzido no sistema, o resultado aparece na hora, sem contagem', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes('reduce') })) as typeof window.matchMedia;
    try {
      const { bob } = await startRenderedGame();
      fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
      await bob.session.play('rock');
      await settle();
      expect(screen.queryByText('Jo…')).toBeNull();
      expect(cardResult()).toBe('Você venceu!');
      expect(screen.getByLabelText('Placar: você 1, adversário 0, 0 empates.')).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });

  it('o cartão da rodada fica na tela desde o início, para não empurrar os botões', async () => {
    await startRenderedGame();
    expect(document.querySelector('.round-card.round-card-current')).not.toBeNull();
    // O histórico também já está lá, vazio, para não empurrar o rodapé depois da primeira rodada.
    expect(screen.getByText('Rodadas anteriores (0)')).toBeTruthy();
    // O "?" usa a cor do tema, não o emoji ❔ (branco, invisível no tema claro).
    expect(document.querySelectorAll('.round-move-placeholder')).toHaveLength(2);
    expect(document.body.textContent).not.toContain('❔');
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

describe('diálogo de confirmação', () => {
  it('em navegador sem showModal, abre e fecha pelo atributo open', async () => {
    const original = HTMLDialogElement.prototype.showModal;
    // @ts-expect-error simula um navegador antigo, sem showModal
    delete HTMLDialogElement.prototype.showModal;
    try {
      const props = { title: 'T', body: 'B', confirmLabel: 'Ok', cancelLabel: 'Não', onConfirm: () => {}, onCancel: () => {} };
      const { rerender } = render(<ConfirmDialog open {...props} />);
      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.hasAttribute('open')).toBe(true);
      rerender(<ConfirmDialog open={false} {...props} />);
      expect(dialog.open).toBe(false);
    } finally {
      HTMLDialogElement.prototype.showModal = original;
    }
  });
});

describe('cartão da rodada atual', () => {
  it('depois de um reset aceito, o cartão volta à rodada 1 sem contagem', async () => {
    const { bob } = await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await bob.session.play('rock');
    await settle();
    await waitFor(() => expect(cardResult()).toBe('Você venceu!'), { timeout: 3000 });

    await bob.session.requestReset();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    await settle();

    expect(screen.queryByText('Jo…')).toBeNull();
    expect(card().classList.contains('round-card-current')).toBe(true);
    expect(card().getAttribute('aria-label')).toBe('Rodada 1');
    expect(screen.getByLabelText('Placar: você 0, adversário 0, 0 empates.')).toBeTruthy();
  });

  it('começa com "?" dos dois lados e mostra a minha jogada do meu lado quando escolho', async () => {
    await startRenderedGame();
    expect(card().querySelectorAll('.round-move-placeholder:not(.is-chosen)')).toHaveLength(2); // ? vs ?

    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await settle();
    expect(cardText()).toContain('✋');
    // O adversário ainda não escolheu: o lado dele continua "?".
    expect(card().querySelectorAll('.round-move-placeholder:not(.is-chosen)')).toHaveLength(1);
  });

  it('quando o adversário escolhe primeiro, o lado dele mostra "✓" sem revelar a jogada', async () => {
    const { bob } = await startRenderedGame();
    await bob.session.play('rock');
    await settle();
    expect(card().querySelector('.round-move-placeholder.is-chosen')?.textContent).toBe('✓');
    expect(cardText()).not.toContain('✊');
  });

  it('o resultado fica alguns segundos e o cartão volta para a rodada seguinte', async () => {
    const { bob } = await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await bob.session.play('rock');
    await settle();
    await waitFor(() => expect(cardResult()).toBe('Você venceu!'), { timeout: 3000 });
    expect(card().getAttribute('aria-label')).toBe('Rodada 1');

    // O adversário já escolhe a próxima; mesmo assim o resultado continua na tela por um tempo,
    // e o status não anuncia "Sua vez!" de uma rodada que o cartão ainda não mostra.
    await bob.session.play('scissors');
    await new Promise((resolve) => setTimeout(resolve, RESULT_HOLD_MS / 2));
    expect(cardResult()).toBe('Você venceu!');
    expect(screen.getByText('Escolha sua jogada para a próxima rodada.')).toBeTruthy();
    expect(screen.queryByText('O adversário já escolheu. Sua vez!')).toBeNull();

    await waitFor(() => expect(card().classList.contains('round-card-current')).toBe(true), { timeout: RESULT_HOLD_MS + 1000 });
    expect(card().getAttribute('aria-label')).toBe('Rodada 2');
    // Agora sim: o cartão mostra a rodada 2, com o "✓" do adversário, e o status acompanha.
    expect(card().querySelector('.round-move-placeholder.is-chosen')).not.toBeNull();
    expect(screen.getByText('O adversário já escolheu. Sua vez!')).toBeTruthy();
    // A rodada anterior continua acessível no histórico.
    expect(screen.getByText('Rodadas anteriores (1)')).toBeTruthy();
  });

  it('escolher a próxima jogada durante o resultado já leva o cartão para a nova rodada', async () => {
    const { bob } = await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await bob.session.play('rock');
    await settle();
    await waitFor(() => expect(cardResult()).toBe('Você venceu!'), { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Tesoura' }));
    await settle();
    expect(card().classList.contains('round-card-current')).toBe(true);
    expect(cardText()).toContain('✌️');
  });
});

describe('prazo para escolher', () => {
  it('quando o adversário escolhe, aparece a contagem e o aviso para leitores de tela', async () => {
    const { bob } = await startRenderedGame();
    expect(document.querySelector('.countdown')).toBeNull();
    await bob.session.play('rock');
    await settle();
    expect(document.querySelector('.countdown')?.textContent).toContain('15 s');
    expect(screen.getByText(/Você tem 15 segundos para escolher\./)).toBeTruthy();
  });

  it('quem já escolheu também vê a contagem do adversário, sem o aviso de prazo próprio', async () => {
    await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await settle();
    expect(document.querySelector('.countdown')).not.toBeNull();
    expect(screen.queryByText(/segundos para escolher/)).toBeNull();
  });
});

describe('tempo para escolher definido na criação da sala', () => {
  it('quem cria escolhe 5, 10 ou 15 s; a escolha vale para a sala e aparece no placar', async () => {
    const alice = createPlayer(server, 'alice');
    await renderPlayer(alice);
    expect((screen.getByRole('radio', { name: '15 s' }) as HTMLInputElement).checked).toBe(true); // padrão
    fireEvent.click(screen.getByRole('radio', { name: '5 s' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await settle();
    expect(localStorage.getItem('jokenpo:choice-seconds')).toBe('5');
    const code = screen.getByText(/^[A-HJKMNP-Z2-9]{4}$/).textContent ?? '';
    expect(server.snapshot(code as never)?.choiceSeconds).toBe(5);

    const bob = createPlayer(server, 'bob');
    await bob.session.start();
    await bob.session.joinRoom(code);
    await settle();
    expect(screen.getByText('5 s para escolher')).toBeTruthy();

    // Com 5 s, a reta final é de 3 s: a contagem começa normal e fica vermelha só no fim.
    await bob.session.play('rock');
    await settle();
    expect(document.querySelector('.countdown')?.textContent).toContain('5 s');
    expect(document.querySelector('.countdown-urgent')).toBeNull();
    server.time += 2_500;
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.querySelector('.countdown-urgent')).not.toBeNull();
  });
});

describe('alerta sonoro no fim do prazo', () => {
  /** AudioContext falso: registra a frequência de cada bipe tocado. */
  const beeps: number[] = [];
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createGain() {
      const ramp = () => undefined;
      return { gain: { setValueAtTime: ramp, exponentialRampToValueAtTime: ramp }, connect: (node: unknown) => node };
    }
    createOscillator() {
      const oscillator = {
        type: '',
        frequency: { value: 0 },
        connect: (node: unknown) => node,
        start: () => beeps.push(oscillator.frequency.value),
        stop: () => undefined,
      };
      return oscillator;
    }
  }

  beforeEach(() => {
    beeps.length = 0;
    (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  });

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** O adversário escolhe e o relógio do servidor pula para `secondsLeft` do fim do prazo. */
  async function opponentChoosesAndTimeRunsTo(secondsLeft: number) {
    const { bob } = await startRenderedGame();
    await bob.session.play('rock');
    await settle();
    const deadline = server.time + 15_000;
    server.time = deadline - secondsLeft * 1000 + 1;
    await wait(300); // a contagem atualiza a cada 250 ms
  }

  it('quem precisa escolher ouve um bipe na reta final', async () => {
    await opponentChoosesAndTimeRunsTo(4);
    expect(beeps).toEqual([880]);
    expect(document.querySelector('.countdown-urgent')).not.toBeNull();
  });

  it('os dois últimos segundos têm bipe mais agudo', async () => {
    await opponentChoosesAndTimeRunsTo(2);
    expect(beeps).toEqual([1320]);
  });

  it('no terceiro segundo antes do fim, o bipe ainda é o normal', async () => {
    await opponentChoosesAndTimeRunsTo(3);
    expect(beeps).toEqual([880]);
  });

  it('antes da reta final, silêncio', async () => {
    await opponentChoosesAndTimeRunsTo(10);
    expect(beeps).toEqual([]);
  });

  it('com o som desligado no cabeçalho, não toca', async () => {
    const { bob } = await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Sons do jogo' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Sons do jogo' }).getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('jokenpo:sound')).toBe('off');
    await bob.session.play('rock');
    await settle();
    server.time += 12_000;
    await wait(300);
    expect(document.querySelector('.countdown-urgent')).not.toBeNull();
    expect(beeps).toEqual([]);
  });

  it('quem já escolheu e está esperando não ouve alerta', async () => {
    await startRenderedGame();
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await settle();
    server.time += 12_000;
    await wait(300);
    expect(document.querySelector('.countdown-urgent')).not.toBeNull();
    expect(beeps).toEqual([]);
  });
});

describe('fim de rodada fora do normal', () => {
  it('W.O. por não escolher: resultado direto, sem "Jo… Ken… Pô!", e "✓" só do lado de quem escolheu', async () => {
    const CHOICE_MS = 50;
    const alice = createPlayer(server, 'alice', { choiceTimeoutMs: CHOICE_MS });
    await renderPlayer(alice);
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await settle();
    const code = screen.getByText(/^[A-HJKMNP-Z2-9]{4}$/).textContent ?? '';
    const bob = createPlayer(server, 'bob', { choiceTimeoutMs: CHOICE_MS });
    await bob.session.start();
    await bob.session.joinRoom(code);
    await settle();

    await bob.session.play('rock'); // Bob escolhe; Alice (a tela) não escolhe nada
    await settle();
    server.time += CHOICE_MS + 1; // o prazo passa no relógio do servidor

    // 500 ms: bem menos que a contagem (~1 s); se ela voltasse a rodar no W.O., este teste falharia.
    await waitFor(() => expect(cardResult()).toContain('Você perdeu.'), { timeout: 500 });
    expect(screen.queryByText('Jo…')).toBeNull();
    expect(card().querySelector('.round-ending-tag')?.textContent).toBe('por W.O.');
    const sides = card().querySelectorAll('.round-move-emoji');
    expect(sides[0]?.textContent).toBe('—'); // eu não escolhi
    expect(sides[1]?.querySelector('.round-move-placeholder.is-chosen')?.textContent).toBe('✓'); // o adversário escolheu (sem revelar)
  });

  it('jogada inválida do adversário: etiqueta curta na linha do resultado, explicação no tooltip', async () => {
    const { bob, code } = await startRenderedGame();
    const matchId = server.snapshot(code as never)?.currentMatch;
    if (!matchId) throw new Error('sala sumiu');
    const nonce = 'c'.repeat(32);
    // Bob grava o hash de "pedra" e depois tenta revelar "papel".
    await bob.gateway.commit(code as never, matchId, 0, 'player2', commitFor('rock', nonce));
    fireEvent.click(screen.getByRole('button', { name: 'Papel' }));
    await settle();
    await bob.gateway.reveal(code as never, matchId, 0, 'player2', 'paper', nonce);
    await settle();

    await waitFor(() => expect(cardResult()).toContain('Você venceu!'), { timeout: 3000 });
    const tag = card().querySelector('.round-ending-tag');
    expect(tag?.textContent).toBe('jogada inválida');
    expect(tag?.getAttribute('title')).toBe('A jogada revelada pelo adversário não conferia com a escolhida.');
    // Uma linha só: não existe mais a linha reservada para a explicação.
    expect(card().querySelector('.round-ending')).toBeNull();
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
    expect(screen.getByText('Melhor de 3 · vence quem fizer 2 · 15 s para escolher')).toBeTruthy();
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
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
  });

  it('jogar contra o computador abre o jogo direto e sair volta para o início', async () => {
    await renderPlayer(createPlayer(server, 'alice'));
    fireEvent.click(screen.getByRole('button', { name: 'Jogar contra o computador' }));
    await waitFor(() => expect(screen.getByText('Contra o computador')).toBeTruthy());
    expect(screen.getAllByText('Computador').length).toBeGreaterThan(0);
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
    // O painel de fim de partida também espera a contagem da última rodada.
    expect(screen.queryByText('🏆 Você venceu a partida!')).toBeNull();
    await waitFor(() => expect(screen.getByText('🏆 Você venceu a partida!')).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText('Placar final: 2 × 0')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revanche' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Sua jogada' })).toBeNull();
  });
});
