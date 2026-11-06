import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Confere o contraste WCAG AA (≥ 4,5:1) de cada par texto × fundo usado na interface,
 * nos temas claro e escuro, lendo os tokens direto de tokens.css.
 * Botões desabilitados ficam de fora: a WCAG não exige contraste para eles.
 */

const css = readFileSync('src/ui/styles/tokens.css', 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, name, value]) => [name, value]));
}

const [lightBlock, darkBlock] = css.split('@media (prefers-color-scheme: dark)');
const light = tokens(lightBlock ?? '');
const dark = { ...light, ...tokens(darkBlock ?? '') };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** [texto, fundo] como usados em app.css. */
const PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-muted'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-muted'],
  ['on-primary', 'primary'],
  ['on-primary', 'primary-hover'],
  ['on-danger', 'danger'],
  ['on-danger', 'danger-hover'],
  ['win', 'surface'],
  ['loss', 'surface'],
  ['tie', 'surface'],
  ['win', 'surface-muted'],
  ['loss', 'surface-muted'],
  ['tie', 'surface-muted'],
  ['warning-text', 'warning-bg'],
  ['toast-text', 'toast-bg'],
];

describe.each([
  ['claro', light],
  ['escuro', dark],
])('contraste no tema %s', (_, theme) => {
  it.each(PAIRS)('%s sobre %s ≥ 4,5:1', (text, background) => {
    const foreground = theme[text];
    const back = theme[background];
    expect(foreground, `token --${text} não encontrado`).toBeDefined();
    expect(back, `token --${background} não encontrado`).toBeDefined();
    expect(contrast(foreground as string, back as string)).toBeGreaterThanOrEqual(4.5);
  });
});
