import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, generateRoomCode, parseRoomCode } from '../src/domain/roomCode';

/** Fonte de aleatoriedade previsível: devolve os valores em sequência. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

describe('generateRoomCode', () => {
  it('sempre gera 4 caracteres do alfabeto, inclusive nos extremos de random()', () => {
    for (const value of [0, 0.5, 0.999999]) {
      const code = generateRoomCode(() => value);
      expect(code).toHaveLength(4);
      expect(parseRoomCode(code)).toEqual({ ok: true, code });
    }
  });

  it('usa a aleatoriedade injetada', () => {
    expect(generateRoomCode(sequence(0, 0.999999, 0, 0.999999))).toBe('A9A9');
  });

  it('nunca usa caracteres ambíguos', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });
});

describe('parseRoomCode', () => {
  it('normaliza minúsculas, espaços e hífens', () => {
    expect(parseRoomCode(' ab-23 ')).toEqual({ ok: true, code: 'AB23' });
  });

  it('acusa entrada vazia', () => {
    expect(parseRoomCode('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('acusa tamanho errado', () => {
    expect(parseRoomCode('AB2')).toEqual({ ok: false, error: 'length' });
    expect(parseRoomCode('AB234')).toEqual({ ok: false, error: 'length' });
  });

  it('acusa caracteres fora do alfabeto, inclusive os que quebrariam o caminho no Firebase', () => {
    for (const input of ['AB.C', 'AB#C', 'AB$C', 'AB/C', 'AB0C', 'ABIC', 'ABÇD']) {
      expect(parseRoomCode(input)).toEqual({ ok: false, error: 'characters' });
    }
  });
});

describe('alfabeto × regras do banco', () => {
  it('a regex de $code em database.rules.json aceita exatamente o alfabeto', () => {
    const rules = readFileSync('database.rules.json', 'utf8');
    const match = rules.match(/\$code\.matches\(\/\^(\[[^\]]+\])\{4\}\$\/\)/);
    expect(match).not.toBeNull();
    const charClass = new RegExp(`^${match?.[1]}$`);
    const accepted = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].filter((char) => charClass.test(char));
    expect(accepted.sort()).toEqual([...ROOM_CODE_ALPHABET].sort());
  });
});
