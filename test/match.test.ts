import { describe, expect, it } from 'vitest';
import { commitFor } from '../src/domain/commitment';
import { DEFAULT_REVEAL_TIMEOUT_MS, evaluateRound, generateMatchId, summarize } from '../src/domain/match';
import type { Move, RoundRecord, SlotEntry } from '../src/domain/types';

const NONCE = 'a'.repeat(32);
const T0 = 1_000_000;
const TIMEOUT = DEFAULT_REVEAL_TIMEOUT_MS;

/** Só o commit (jogou, mas ainda não revelou). */
const committed = (move: Move): SlotEntry => ({ commit: commitFor(move, NONCE) });

/** Commit + reveal válido, revelado no instante `at`. */
const revealed = (move: Move, at = T0): SlotEntry => ({
  commit: commitFor(move, NONCE),
  reveal: { move, nonce: NONCE, at },
});

/** Commit de uma jogada, mas reveal de outra (trapaça ou bug). */
const cheated = (committedMove: Move, revealedMove: Move, at = T0): SlotEntry => ({
  commit: commitFor(committedMove, NONCE),
  reveal: { move: revealedMove, nonce: NONCE, at },
});

const played = (player1: Move, player2: Move): RoundRecord => ({ player1: revealed(player1), player2: revealed(player2) });

const at = (now: number) => ({ now });

describe('evaluateRound: rodada em aberto', () => {
  it('sem nenhuma jogada, está na fase de escolha', () => {
    expect(evaluateRound(undefined, 0, at(T0))).toEqual({
      status: 'pending',
      round: { index: 0, phase: 'choosing', committed: { player1: false, player2: false } },
    });
  });

  it('mostra quem já escolheu, sem revelar a jogada', () => {
    const result = evaluateRound({ player1: committed('rock') }, 0, at(T0));
    expect(result).toEqual({
      status: 'pending',
      round: { index: 0, phase: 'choosing', committed: { player1: true, player2: false } },
    });
  });

  it('com os dois commits e nenhum reveal, está revelando sem prazo', () => {
    const result = evaluateRound({ player1: committed('rock'), player2: committed('paper') }, 0, at(T0));
    expect(result).toEqual({
      status: 'pending',
      round: { index: 0, phase: 'revealing', revealed: { player1: false, player2: false }, deadline: null },
    });
  });

  it('com um reveal, o prazo do outro começa a contar', () => {
    const result = evaluateRound({ player1: revealed('rock'), player2: committed('paper') }, 0, at(T0 + 1000));
    expect(result).toEqual({
      status: 'pending',
      round: { index: 0, phase: 'revealing', revealed: { player1: true, player2: false }, deadline: T0 + TIMEOUT },
    });
  });
});

describe('evaluateRound: rodada concluída', () => {
  it('as duas jogadas reveladas decidem a rodada', () => {
    expect(evaluateRound(played('rock', 'scissors'), 3, at(T0))).toEqual({
      status: 'complete',
      round: { index: 3, outcome: 'player1', ending: 'played', moves: { player1: 'rock', player2: 'scissors' } },
    });
  });

  it('empate', () => {
    const result = evaluateRound(played('paper', 'paper'), 0, at(T0));
    expect(result.status === 'complete' && result.round.outcome).toBe('tie');
  });

  it('quem não revela no prazo perde por W.O.', () => {
    const result = evaluateRound({ player1: committed('rock'), player2: revealed('paper') }, 0, at(T0 + TIMEOUT + 1));
    expect(result).toEqual({
      status: 'complete',
      round: { index: 0, outcome: 'player2', ending: 'reveal-timeout', moves: { player2: 'paper' } },
    });
  });

  it('revelar depois do prazo não muda o W.O. (o resultado não depende de quando se olha)', () => {
    const record: RoundRecord = { player1: revealed('rock', T0 + TIMEOUT + 1), player2: revealed('scissors', T0) };
    for (const now of [T0 + TIMEOUT + 2, T0 + 10 * TIMEOUT]) {
      const result = evaluateRound(record, 0, at(now));
      expect(result.status === 'complete' && result.round).toMatchObject({ outcome: 'player2', ending: 'reveal-timeout' });
    }
  });

  it('revelar exatamente no limite do prazo ainda vale', () => {
    const record: RoundRecord = { player1: revealed('rock', T0 + TIMEOUT), player2: revealed('scissors', T0) };
    const result = evaluateRound(record, 0, at(T0 + TIMEOUT));
    expect(result.status === 'complete' && result.round).toMatchObject({ outcome: 'player1', ending: 'played' });
  });

  it('trocar a jogada no reveal dá a rodada ao adversário, na hora', () => {
    const record: RoundRecord = { player1: cheated('rock', 'paper'), player2: committed('rock') };
    const result = evaluateRound(record, 0, at(T0));
    expect(result.status === 'complete' && result.round).toMatchObject({ outcome: 'player2', ending: 'invalid-reveal' });
  });

  it('a jogada inválida nunca aparece como jogada revelada', () => {
    const record: RoundRecord = { player1: cheated('rock', 'paper'), player2: revealed('rock') };
    const result = evaluateRound(record, 0, at(T0));
    expect(result.status === 'complete' && result.round.moves).toEqual({ player2: 'rock' });
  });

  it('se os dois revelam algo inválido, a rodada é anulada e conta como empate', () => {
    const record: RoundRecord = { player1: cheated('rock', 'paper'), player2: cheated('rock', 'scissors') };
    const result = evaluateRound(record, 0, at(T0));
    expect(result.status === 'complete' && result.round).toMatchObject({ outcome: 'tie', ending: 'void' });
  });

  it('o prazo pode ser configurado', () => {
    const record: RoundRecord = { player1: revealed('rock'), player2: committed('paper') };
    const result = evaluateRound(record, 0, { now: T0 + 2000, revealTimeoutMs: 1000 });
    expect(result.status).toBe('complete');
  });
});

describe('summarize', () => {
  it('partida nova: placar zerado na rodada 0', () => {
    expect(summarize([], at(T0))).toEqual({
      scores: { player1: 0, player2: 0 },
      ties: 0,
      history: [],
      winner: null,
      current: { index: 0, phase: 'choosing', committed: { player1: false, player2: false } },
    });
  });

  it('soma vitórias e empates de todas as rodadas concluídas', () => {
    const rounds = [
      played('rock', 'scissors'), // player1
      played('rock', 'paper'), // player2
      played('paper', 'paper'), // empate
      played('scissors', 'paper'), // player1
      { player1: committed('rock') },
    ];
    const summary = summarize(rounds, at(T0));
    expect(summary.scores).toEqual({ player1: 2, player2: 1 });
    expect(summary.ties).toBe(1);
    expect(summary.history.map((round) => round.outcome)).toEqual(['player1', 'player2', 'tie', 'player1']);
    expect(summary.current).toMatchObject({ index: 4, phase: 'choosing' });
  });

  it('ignora rodadas depois da primeira em aberto', () => {
    const rounds = [played('rock', 'scissors'), undefined, played('rock', 'scissors')];
    const summary = summarize(rounds, at(T0));
    expect(summary.scores).toEqual({ player1: 1, player2: 0 });
    expect(summary.current.index).toBe(1);
  });

  it('conta W.O. no placar', () => {
    const rounds = [{ player1: revealed('rock'), player2: committed('paper') }];
    const summary = summarize(rounds, at(T0 + TIMEOUT + 1));
    expect(summary.scores).toEqual({ player1: 1, player2: 0 });
    expect(summary.current.index).toBe(1);
  });
});

describe('summarize: melhor de N', () => {
  const p1Wins = () => played('rock', 'scissors');
  const p2Wins = () => played('rock', 'paper');
  const tie = () => played('rock', 'rock');

  it('melhor de 3: quem faz 2 vitórias leva a partida', () => {
    const summary = summarize([p1Wins(), p2Wins(), p1Wins()], { now: T0, bestOf: 3 });
    expect(summary.winner).toBe('player1');
    expect(summary.scores).toEqual({ player1: 2, player2: 1 });
  });

  it('empates não contam para o melhor de N', () => {
    const summary = summarize([tie(), tie(), p2Wins(), tie(), p2Wins()], { now: T0, bestOf: 3 });
    expect(summary.winner).toBe('player2');
    expect(summary.ties).toBe(3);
  });

  it('sem vitórias suficientes, a partida segue', () => {
    const summary = summarize([p1Wins(), p2Wins()], { now: T0, bestOf: 5 });
    expect(summary.winner).toBeNull();
    expect(summary.current.index).toBe(2);
  });

  it('rodadas gravadas depois da decisão são ignoradas', () => {
    const summary = summarize([p1Wins(), p1Wins(), p2Wins(), p2Wins()], { now: T0, bestOf: 3 });
    expect(summary.winner).toBe('player1');
    expect(summary.history).toHaveLength(2);
    expect(summary.scores).toEqual({ player1: 2, player2: 0 });
  });

  it('partida livre (0) nunca tem vencedor', () => {
    const summary = summarize(Array.from({ length: 10 }, p1Wins), { now: T0, bestOf: 0 });
    expect(summary.winner).toBeNull();
    expect(summary.scores.player1).toBe(10);
  });

  it('melhor de 7 precisa de 4 vitórias', () => {
    expect(summarize(Array.from({ length: 3 }, p1Wins), { now: T0, bestOf: 7 }).winner).toBeNull();
    expect(summarize(Array.from({ length: 4 }, p1Wins), { now: T0, bestOf: 7 }).winner).toBe('player1');
  });
});

describe('generateMatchId', () => {
  it('gera ids compatíveis com a regra $matchId do banco', () => {
    for (const value of [0, 0.5, 0.999999]) {
      expect(generateMatchId(() => value)).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    }
  });
});
