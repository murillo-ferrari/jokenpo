import { afterEach, describe, expect, it } from 'vitest';
import type { GameView, PlayingView } from '../src/application/view';
import { startComputerGame } from '../src/computerGame';
import type { ComputerGame } from '../src/ui/App';

/* Partida contra o computador de ponta a ponta: sessão real, servidor em memória e o adversário automático. */

let game: ComputerGame | null = null;

afterEach(() => {
  game?.dispose();
  game = null;
});

async function waitForView(predicate: (view: GameView) => boolean): Promise<GameView> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const view = game?.session.getView();
    if (view && predicate(view)) return view;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Tempo esgotado. Tela: ${JSON.stringify(game?.session.getView())}`);
}

const isPlaying = (view: GameView): view is PlayingView => view.screen === 'playing';

describe('jogar contra o computador', () => {
  it('o computador entra na hora, sem passar pela sala de espera', async () => {
    game = await startComputerGame(0, 'Ana', { thinkingMs: [1, 2] });
    const view = await waitForView(isPlaying);
    expect(view).toMatchObject({ vsComputer: true, myName: 'Ana', canPlay: true });
  });

  it('o computador escolhe, revela e a rodada fecha', async () => {
    game = await startComputerGame(0, null, { thinkingMs: [1, 2] });
    await waitForView((view) => isPlaying(view) && view.canPlay);
    await game.session.play('rock');
    const view = (await waitForView((v) => isPlaying(v) && v.roundNumber === 2)) as PlayingView;
    expect(view.lastRound?.myMove).toBe('rock');
    expect(view.lastRound?.opponentMove).toMatch(/rock|paper|scissors/);
  });

  it('melhor de 3 até o fim e revanche aceita pelo computador', async () => {
    game = await startComputerGame(3, null, { thinkingMs: [1, 2] });
    for (let i = 0; i < 50; i += 1) {
      const view = (await waitForView((v) => isPlaying(v) && (v.canPlay || v.phase === 'finished'))) as PlayingView;
      if (view.phase === 'finished') break;
      await game.session.play('paper');
    }
    const finished = (await waitForView((v) => isPlaying(v) && v.phase === 'finished')) as PlayingView;
    expect(Math.max(finished.scores.me, finished.scores.opponent)).toBe(2);

    await game.session.rematch();
    const again = await waitForView((v) => isPlaying(v) && v.phase === 'choosing' && v.roundNumber === 1);
    expect(again).toMatchObject({ scores: { me: 0, opponent: 0 }, bestOf: 3 });
  });

  it('contra o computador não há prazo para escolher', async () => {
    game = await startComputerGame(0, null, { thinkingMs: [1, 2] });
    const view = (await waitForView((v) => isPlaying(v) && v.opponentHasChosen)) as PlayingView;
    expect(view.choiceDeadline).toBeNull();
  });

  it('sair encerra a partida e volta à tela inicial', async () => {
    game = await startComputerGame(0, null, { thinkingMs: [1, 2] });
    await waitForView(isPlaying);
    await game.session.leave();
    expect(game.session.getView().screen).toBe('home');
  });
});
