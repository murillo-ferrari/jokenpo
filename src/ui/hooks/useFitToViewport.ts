import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';

/** Quantas linhas (rodadas) ficam visíveis no mínimo, mesmo em telas sem espaço sobrando. */
const MIN_VISIBLE_ROWS = 3;
/** Altura de uma linha caso a lista ainda esteja vazia (igual a --history-row, 2.25rem). */
const FALLBACK_ROW_PX = 36;

/** Altura de `rows` linhas da lista, medida nas próprias linhas (com o espaçamento entre elas). */
function heightOfRows(list: HTMLElement, rows: number): number {
  const row = list.querySelector('li')?.getBoundingClientRect().height || FALLBACK_ROW_PX;
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  return rows * row + (rows - 1) * gap;
}

/**
 * Enquanto `active`, limita a altura do elemento ao espaço livre que sobra na janela abaixo do
 * conteúdo, via a variável CSS `--fit-height`. Assim, abrir a lista rola só a lista, sem fazer
 * a página ficar mais alta que a janela (e sem criar rolagem no app todo).
 * Recalcula quando a janela muda de tamanho ou quando o conteúdo da página muda de altura.
 */
export function useFitToViewport(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useLayoutEffect(() => {
    const element = ref.current;
    const page = document.getElementById('app');
    if (!active || !element || !page) return;

    const update = () => {
      // Altura de todo o resto da página = altura da página sem a lista.
      const others = page.offsetHeight - element.offsetHeight;
      const free = window.innerHeight - others;
      element.style.setProperty('--fit-height', `${Math.max(heightOfRows(element, MIN_VISIBLE_ROWS), free)}px`);
    };

    update();
    window.addEventListener('resize', update);
    // Rodada nova, aviso de reset etc. mudam a altura da página: recalcula.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(page);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
      element.style.removeProperty('--fit-height');
    };
  }, [ref, active]);
}
