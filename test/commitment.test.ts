import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { commitFor, isCommit, isNonce, verifyReveal } from '../src/domain/commitment';

const NONCE = '0123456789abcdef0123456789abcdef';

describe('commitFor', () => {
  it('é o SHA-256 de "jogada:nonce" (conferido com node:crypto)', () => {
    const expected = createHash('sha256').update(`rock:${NONCE}`).digest('hex');
    expect(commitFor('rock', NONCE)).toBe(expected);
  });

  it('gera um commit no formato aceito pelas regras do banco', () => {
    expect(isCommit(commitFor('paper', NONCE))).toBe(true);
  });

  it('jogadas diferentes com o mesmo nonce geram commits diferentes', () => {
    expect(commitFor('rock', NONCE)).not.toBe(commitFor('paper', NONCE));
  });

  it('recusa nonce fora do formato', () => {
    expect(() => commitFor('rock', 'curto')).toThrow(/Nonce inválido/);
    expect(() => commitFor('rock', NONCE.toUpperCase())).toThrow(/Nonce inválido/);
  });
});

describe('verifyReveal', () => {
  const commit = commitFor('scissors', NONCE);

  it('aceita o reveal que corresponde ao commit', () => {
    expect(verifyReveal(commit, { move: 'scissors', nonce: NONCE })).toBe(true);
  });

  it('recusa trocar a jogada depois do commit', () => {
    expect(verifyReveal(commit, { move: 'rock', nonce: NONCE })).toBe(false);
  });

  it('recusa nonce diferente', () => {
    expect(verifyReveal(commit, { move: 'scissors', nonce: 'f'.repeat(32) })).toBe(false);
  });

  it('recusa commit ou nonce malformados sem lançar erro', () => {
    expect(verifyReveal('xyz', { move: 'scissors', nonce: NONCE })).toBe(false);
    expect(verifyReveal(commit, { move: 'scissors', nonce: 'nope' })).toBe(false);
  });
});

describe('formatos', () => {
  it('isNonce exige 32 hexadecimais minúsculos', () => {
    expect(isNonce(NONCE)).toBe(true);
    expect(isNonce(NONCE.slice(1))).toBe(false);
    expect(isNonce('g'.repeat(32))).toBe(false);
  });
});
