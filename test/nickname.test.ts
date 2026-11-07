import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX_LENGTH, normalizeNickname } from '../src/domain/nickname';

describe('normalizeNickname', () => {
  it('tira espaços nas pontas e junta espaços repetidos', () => {
    expect(normalizeNickname('  Ana   Maria ')).toBe('Ana Maria');
  });

  it('vazio ou só espaços vira null', () => {
    expect(normalizeNickname('')).toBeNull();
    expect(normalizeNickname('   ')).toBeNull();
  });

  it('remove caracteres de controle e invisíveis', () => {
    expect(normalizeNickname('Bo\u0000b​')).toBe('Bob');
  });

  it(`corta em ${NICKNAME_MAX_LENGTH} caracteres sem quebrar emojis`, () => {
    expect(normalizeNickname('x'.repeat(30))).toHaveLength(NICKNAME_MAX_LENGTH);
    const emojis = normalizeNickname('😀'.repeat(25)) ?? '';
    expect([...emojis]).toHaveLength(NICKNAME_MAX_LENGTH);
    expect(emojis).toBe('😀'.repeat(NICKNAME_MAX_LENGTH));
  });
});
