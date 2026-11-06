import { useId, useLayoutEffect, useRef } from 'preact/hooks';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo modal com `<dialog>` nativo: o navegador cuida de prender o foco,
 * fechar com Esc e esconder o resto da página de leitores de tela.
 * O foco inicial vai para a opção que não muda nada.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, tone = 'primary', onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // Layout effect: o modal abre/fecha no mesmo quadro da renderização, sem piscar.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={bodyId}>{body}</p>
      <div class="dialog-actions">
        <button type="button" class="button button-secondary" onClick={onCancel} autofocus>
          {cancelLabel}
        </button>
        <button type="button" class={`button button-${tone}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
