/*
 * Link de convite: https://…/jokenpo/?sala=AB23
 * Quem abre o link entra direto na sala. O parâmetro some da barra de endereço depois de lido,
 * para um F5 não tentar entrar de novo numa sala da qual a pessoa já saiu.
 */

const INVITE_PARAM = 'sala';

export function inviteUrl(code: string, location: Location = window.location): string {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set(INVITE_PARAM, code);
  return url.toString();
}

/** Lê o código do convite e o remove da URL. */
export function takeInviteCode(location: Location = window.location, history: History = window.history): string | null {
  const url = new URL(location.href);
  const code = url.searchParams.get(INVITE_PARAM);
  if (code === null) return null;
  url.searchParams.delete(INVITE_PARAM);
  history.replaceState(history.state, '', url.toString());
  return code;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export function canShareNatively(): boolean {
  return typeof navigator.share === 'function';
}

/** Compartilhamento nativo (celular). Se não houver, copia o link. */
export async function shareInvite(data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (canShareNatively()) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(data.url)) ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
