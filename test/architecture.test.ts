import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve('src');

/** Para cada camada, quais camadas (ou arquivos) ela pode importar. */
const ALLOWED: Record<string, string[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'infrastructure', 'application/ports.ts'],
  ui: ['domain/types.ts', 'application', 'ui'],
};

/** Pacotes externos proibidos por camada (domínio e aplicação não conhecem Firebase nem Preact). */
const FORBIDDEN_PACKAGES: Record<string, RegExp> = {
  domain: /^(firebase|@firebase|preact)/,
  application: /^(firebase|@firebase|preact)/,
  ui: /^(firebase|@firebase)/,
};

// Cobre `import x from '…'`, `export … from '…'`, `import '…'` (só efeito colateral) e `import('…')`.
const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(IMPORT)].map(([, a, b]) => (a ?? b) as string);
}

function resolveTarget(file: string, specifier: string): string {
  const target = relative(SRC, resolve(dirname(file), specifier)).split(/[\\/]/).join('/');
  return /\.tsx?$/.test(target) ? target : `${target}.ts`;
}

function isAllowed(target: string, allowed: string[]): boolean {
  return allowed.some((rule) => (rule.endsWith('.ts') ? target === rule : target.startsWith(`${rule}/`)));
}

describe('camadas de src/', () => {
  it.each(Object.keys(ALLOWED))('%s só depende do que é permitido', (layer) => {
    const files = sourceFiles(join(SRC, layer));
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) =>
      importsOf(file).flatMap((specifier) => {
        const where = relative(SRC, file);
        if (specifier.startsWith('.')) {
          const target = resolveTarget(file, specifier);
          return isAllowed(target, ALLOWED[layer] ?? []) ? [] : [`${where} importa ${target}`];
        }
        return FORBIDDEN_PACKAGES[layer]?.test(specifier) ? [`${where} importa o pacote ${specifier}`] : [];
      }),
    );

    expect(violations).toEqual([]);
  });
});
