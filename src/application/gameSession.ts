import { summarize, type MatchSummary } from '../domain/match';
import { normalizeNickname } from '../domain/nickname';
import { STALE_PLAYER_MS, isAlone, opponentStatus, slotOf, type Room } from '../domain/room';
import { DEFAULT_CHOICE_SECONDS, opponentOf, type BestOf, type ChoiceSeconds, type Move, type PlayerId, type PlayerSlot, type RoomCode } from '../domain/types';
import { createRoom } from './createRoom';
import { joinRoom } from './joinRoom';
import { leaveRoom } from './leaveRoom';
import { commitMove, isPendingFor, revealMove, type RoundContext } from './playMove';
import type { Clock, Identity, Random, RoomGateway, SessionStore, Unsubscribe } from './ports';
import { acceptReset, dismissReset, requestReset, startFreshMatch } from './resetMatch';
import { buildPlayingView, type GameView, type HomeView, type Notice } from './view';

export interface GameSessionDeps {
  identity: Identity;
  gateway: RoomGateway;
  clock: Clock;
  random: Random;
  store: SessionStore;
  /** Partida contra o computador: só muda o que a tela mostra. */
  vsComputer?: boolean;
  /** Quanto esperar o servidor ao criar/entrar numa sala antes de desistir. Padrão: CONNECT_TIMEOUT_MS. */
  connectTimeoutMs?: number;
  /**
   * Prazo para escolher a jogada. Sem valor: o tempo definido na sala. `null` desliga
   * (contra o computador). Um número substitui o da sala (testes).
   */
  choiceTimeoutMs?: number | null;
}

type Listener<T> = (value: T) => void;

interface ActiveRoom {
  code: RoomCode;
  stopWatch: Unsubscribe;
  stopPresence: Unsubscribe | null;
  slot: PlayerSlot | null;
}

/** Folga depois de um prazo antes de reavaliar, para não cair exatamente na borda. */
const TIMER_MARGIN_MS = 50;

/**
 * Sem conexão, o Firebase espera a rede voltar indefinidamente. Depois deste tempo,
 * criar/entrar desiste e a tela inicial volta a funcionar (inclusive o jogo contra o computador).
 */
export const CONNECT_TIMEOUT_MS = 10_000;

class ConnectionTimeout extends Error {
  constructor() {
    super('O servidor não respondeu a tempo.');
  }
}

/** Rejeita com `ConnectionTimeout` se a promessa não terminar em `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ConnectionTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Orquestra uma sessão de jogo neste navegador: liga os casos de uso às mudanças
 * da sala e produz o `GameView` que a interface desenha.
 *
 * Tudo que acontece "sozinho" mora aqui: revelar a jogada quando os dois já escolheram,
 * liberar a vaga de quem sumiu, começar partida nova quando o adversário sai.
 */
export class GameSession {
  private view: GameView = { screen: 'loading' };
  private readonly viewListeners = new Set<Listener<GameView>>();
  private readonly noticeListeners = new Set<Listener<Notice>>();

  private player: PlayerId | null = null;
  private active: ActiveRoom | null = null;
  private room: Room | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  // Ações em andamento: evitam repetir a mesma escrita a cada atualização da sala.
  private committing = false;
  private revealing = false;
  private startingFreshMatch = false;
  private releasingOpponent = false;
  private clearingOrphanReset = false;
  private cancelledMyReset = false;

  constructor(private readonly deps: GameSessionDeps) {}

  // ---- Observação ---------------------------------------------------------

  getView(): GameView {
    return this.view;
  }

  /** Horário do servidor, para a tela mostrar a contagem dos prazos. */
  serverNow(): number {
    return this.deps.clock.now();
  }

  subscribe(listener: Listener<GameView>): Unsubscribe {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  }

  onNotice(listener: Listener<Notice>): Unsubscribe {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  // ---- Comandos -----------------------------------------------------------

  /**
   * Inicia a sessão. Com código de convite (link `?sala=`), entra nessa sala;
   * senão, volta para a sala em que estava antes de recarregar a página, se ainda existir.
   */
  async start(inviteCode: string | null = null): Promise<void> {
    try {
      await this.connect(this.ensurePlayer());
    } catch (error) {
      // Sem identidade (por exemplo, offline na primeira visita): a tela inicial continua usável,
      // e criar/entrar tentam de novo. O modo contra o computador não depende disto.
      this.goHome(error instanceof ConnectionTimeout ? 'unreachable' : 'unexpected');
      return;
    }

    // Convite tem prioridade: erros aparecem, porque a pessoa acabou de abrir o link.
    if (inviteCode) {
      await this.enter(inviteCode, { showErrors: true });
      return;
    }

    // Volta à sala de antes do F5; se ela não existe mais, cai na tela inicial sem alarde.
    const saved = this.deps.store.loadRoom();
    if (saved) {
      await this.enter(saved, { showErrors: false });
      return;
    }

    this.goHome(null);
  }

  async createRoom(bestOf: BestOf = 0, choiceSeconds: ChoiceSeconds = DEFAULT_CHOICE_SECONDS): Promise<void> {
    this.setHome(true, null);
    try {
      const player = await this.connect(this.ensurePlayer());
      const options = { hostName: this.deps.store.loadNickname(), bestOf, choiceSeconds };
      const code = await this.connect(createRoom(this.deps, player, options));
      this.attach(code);
    } catch (error) {
      this.goHome(error instanceof ConnectionTimeout ? 'unreachable' : 'unexpected');
    }
  }

  async joinRoom(input: string): Promise<void> {
    await this.enter(input, { showErrors: true });
  }

  async play(move: Move): Promise<void> {
    const context = this.currentRoundContext();
    if (!context || this.view.screen !== 'playing' || !this.view.canPlay) return;
    this.committing = true;
    this.render();
    try {
      await commitMove(this.deps, context, move);
    } catch {
      this.notify('action-failed');
    } finally {
      this.committing = false;
      this.render();
    }
  }

  /** Define o apelido (vazio remove). Vale para esta sala e para as próximas. */
  async setNickname(input: string): Promise<void> {
    const name = normalizeNickname(input);
    this.deps.store.saveNickname(name);
    if (this.view.screen === 'home') this.setHome(this.view.busy, this.view.error);
    const code = this.active?.code;
    const slot = this.active?.slot;
    if (code && slot) await this.run(() => this.deps.gateway.setName(code, slot, name));
  }

  /** Revanche depois de uma partida decidida: aceita o pedido do adversário, ou faz o pedido. */
  async rematch(): Promise<void> {
    const request = this.room?.resetRequest;

    // Ninguém pediu ainda: eu peço.
    if (!request) {
      await this.requestReset();
      return;
    }

    // O pedido já é meu: só resta esperar a resposta.
    if (request.by === this.player) return;

    // O adversário pediu: clicar em "Revanche" também é aceitar.
    await this.respondToReset(true);
  }

  async requestReset(): Promise<void> {
    const code = this.active?.code;
    if (!code) return;
    this.cancelledMyReset = false;
    await this.run(() => requestReset(this.deps, code, this.requirePlayer()));
  }

  async respondToReset(accept: boolean): Promise<void> {
    const code = this.active?.code;
    if (!code) return;
    await this.run(() => (accept ? acceptReset(this.deps, code) : dismissReset(this.deps, code)));
  }

  async cancelReset(): Promise<void> {
    const code = this.active?.code;
    if (!code) return;
    this.cancelledMyReset = true;
    await this.run(() => dismissReset(this.deps, code));
  }

  async leave(): Promise<void> {
    const { room } = this;
    const slot = this.active?.slot ?? null;
    this.detach();
    this.forgetRoom();
    this.goHome(null);
    if (room && slot) await leaveRoom(this.deps, room, slot).catch(() => undefined);
  }

  /** Para de ouvir a sala sem sair dela (fechar a aba equivale a isto). */
  dispose(): void {
    this.detach();
  }

  // ---- Entrada na sala ----------------------------------------------------

  private async enter(input: string, { showErrors }: { showErrors: boolean }): Promise<void> {
    this.setHome(true, null);
    try {
      const player = await this.connect(this.ensurePlayer());
      const result = await this.connect(joinRoom(this.deps, input, player, this.deps.store.loadNickname()));
      if (result.ok) {
        this.attach(result.code);
        return;
      }
      this.forgetRoom();
      this.goHome(showErrors ? result.error : null);
    } catch (error) {
      // Sem conexão: avisa sempre (mesmo ao voltar à sala salva) e NÃO esquece a sala,
      // para voltar a ela quando a rede voltar.
      if (error instanceof ConnectionTimeout) {
        this.goHome('unreachable');
        return;
      }
      this.forgetRoom();
      this.goHome(showErrors ? 'unexpected' : null);
    }
  }

  /** Espera o servidor até o limite de conexão. */
  private connect<T>(promise: Promise<T>): Promise<T> {
    return withTimeout(promise, this.deps.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);
  }

  private attach(code: RoomCode): void {
    this.detach();
    this.deps.store.saveRoom(code);
    this.active = {
      code,
      slot: null,
      stopPresence: null,
      stopWatch: this.deps.gateway.watch(
        code,
        (room) => this.onRoom(room),
        () => this.exitRoom('connection-lost'),
      ),
    };
    this.setView({ screen: 'loading' });
  }

  private detach(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.active?.stopPresence?.();
    this.active?.stopWatch();
    this.active = null;
    this.room = null;
  }

  private exitRoom(notice: Notice): void {
    this.detach();
    this.forgetRoom();
    this.goHome(null);
    this.notify(notice);
  }

  private forgetRoom(): void {
    this.deps.store.saveRoom(null);
    this.deps.store.savePendingMove(null);
  }

  // ---- Reação às mudanças da sala ----------------------------------------

  private onRoom(room: Room | null): void {
    const active = this.active;
    if (!active) return;
    const previous = this.room;
    this.room = room;

    if (!room) return this.exitRoom('room-closed');
    const slot = slotOf(room, this.requirePlayer());
    if (!slot) return this.exitRoom('removed-from-room');

    if (active.slot !== slot) {
      active.stopPresence?.();
      active.stopPresence = this.deps.gateway.trackPresence(room.code, slot);
      active.slot = slot;
    }

    if (previous) this.announceChanges(previous, room, slot);
    this.housekeeping();
    this.render();
  }

  private announceChanges(previous: Room, room: Room, slot: PlayerSlot): void {
    this.announceOpponentChange(previous, room, slot);
    this.announceResetOutcome(previous, room);
  }

  /** Avisa quando o adversário entra (ou é trocado por outro) e quando sai. */
  private announceOpponentChange(previous: Room, room: Room, slot: PlayerSlot): void {
    const opponent = opponentOf(slot);
    const before = previous.players[opponent]?.id;
    const after = room.players[opponent]?.id;

    if (after && after !== before) {
      this.notify('opponent-joined');
      return;
    }
    if (before && !after) this.notify('opponent-left');
  }

  /** Quando o MEU pedido de reset some: aceito (partida nova), recusado, ou cancelado por mim (sem aviso). */
  private announceResetOutcome(previous: Room, room: Room): void {
    const myRequestWasAnswered = previous.resetRequest?.by === this.requirePlayer() && !room.resetRequest;
    if (!myRequestWasAnswered) return;

    const cancelledByMe = this.cancelledMyReset;
    this.cancelledMyReset = false;

    if (room.currentMatch !== previous.currentMatch) {
      this.notify('reset-accepted');
      return;
    }
    if (!cancelledByMe) this.notify('reset-declined');
  }

  /** Escritas automáticas, disparadas pelo estado da sala (e pelo relógio). */
  private housekeeping(): void {
    const { room } = this;
    const slot = this.active?.slot;
    if (!room || !slot) return;
    const now = this.deps.clock.now();
    const summary = this.summary(room);

    // Vaga de quem sumiu há mais de 60 s volta a ficar livre.
    if (opponentStatus(room, slot, now) === 'stale' && !this.releasingOpponent) {
      this.releasingOpponent = true;
      void this.deps.gateway
        .releaseSlot(room.code, opponentOf(slot))
        .catch(() => undefined)
        .finally(() => (this.releasingOpponent = false));
    }

    // Sozinho com uma partida já começada: a próxima pessoa começa do zero.
    if (isAlone(room, slot) && room.rounds.length > 0 && !this.startingFreshMatch) {
      this.startingFreshMatch = true;
      void startFreshMatch(this.deps, room.code)
        .catch(() => undefined)
        .finally(() => (this.startingFreshMatch = false));
    }

    // Pedido de reset de quem já saiu da sala.
    const requester = room.resetRequest?.by;
    if (requester && !slotOf(room, requester) && !this.clearingOrphanReset) {
      this.clearingOrphanReset = true;
      void dismissReset(this.deps, room.code)
        .catch(() => undefined)
        .finally(() => (this.clearingOrphanReset = false));
    }

    // Jogada guardada de uma rodada que já acabou não serve mais.
    const context: RoundContext = { code: room.code, matchId: room.currentMatch, round: summary.current.index, slot };
    const pending = this.deps.store.loadPendingMove();
    if (pending && !isPendingFor(pending, context)) this.deps.store.savePendingMove(null);

    // Os dois escolheram: hora de revelar a minha.
    const { current } = summary;
    if (current.phase === 'revealing' && !current.revealed[slot] && isPendingFor(pending, context) && !this.revealing) {
      this.revealing = true;
      void revealMove(this.deps, context, pending)
        .catch(() => this.notify('action-failed'))
        .finally(() => (this.revealing = false));
    }
  }

  // ---- Desenho ------------------------------------------------------------

  private render(): void {
    const { room } = this;
    const slot = this.active?.slot;
    if (!room || !slot) return;

    if (isAlone(room, slot)) {
      this.setView({ screen: 'waiting', code: room.code, bestOf: room.bestOf });
      this.schedule(room, slot, this.summary(room));
      return;
    }

    const now = this.deps.clock.now();
    const summary = this.summary(room);
    const pending = this.deps.store.loadPendingMove();
    const context = { code: room.code, matchId: room.currentMatch, round: summary.current.index };
    this.setView(
      buildPlayingView({
        room,
        mySlot: slot,
        me: this.requirePlayer(),
        summary,
        myPendingMove: isPendingFor(pending, context) ? pending.move : null,
        now,
        busy: this.committing,
        vsComputer: this.deps.vsComputer ?? false,
      }),
    );
    this.schedule(room, slot, summary);
  }

  /** Reavalia a sala no próximo prazo: fim do tempo para revelar ou vaga abandonada. */
  private schedule(room: Room, slot: PlayerSlot, summary: MatchSummary): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    const now = this.deps.clock.now();
    const deadlines: number[] = [];
    // Fim do prazo para revelar ou para escolher: reavalia para aplicar o W.O.
    if (summary.current.deadline !== null) deadlines.push(summary.current.deadline);
    const opponent = room.players[opponentOf(slot)];
    if (opponent && !opponent.connected) deadlines.push(opponent.seenAt + STALE_PLAYER_MS);

    const next = Math.min(...deadlines.filter((deadline) => deadline >= now));
    if (!Number.isFinite(next)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.housekeeping();
      this.render();
    }, next - now + TIMER_MARGIN_MS);
  }

  // ---- Auxiliares ---------------------------------------------------------

  private summary(room: Room): MatchSummary {
    return summarize(room.rounds, {
      now: this.deps.clock.now(),
      bestOf: room.bestOf,
      choiceTimeoutMs: this.deps.choiceTimeoutMs === undefined ? room.choiceSeconds * 1000 : this.deps.choiceTimeoutMs,
    });
  }

  private currentRoundContext(): RoundContext | null {
    const { room } = this;
    const slot = this.active?.slot;
    if (!room || !slot) return null;
    return { code: room.code, matchId: room.currentMatch, round: this.summary(room).current.index, slot };
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      this.notify('action-failed');
    }
  }

  private async ensurePlayer(): Promise<PlayerId> {
    this.player ??= await this.deps.identity.ensurePlayer();
    return this.player;
  }

  private requirePlayer(): PlayerId {
    if (!this.player) throw new Error('Sessão não iniciada: chame start() antes.');
    return this.player;
  }

  private goHome(error: HomeView['error']): void {
    this.setHome(false, error);
  }

  private setHome(busy: boolean, error: HomeView['error']): void {
    this.setView({ screen: 'home', busy, error, nickname: this.deps.store.loadNickname() });
  }

  private setView(view: GameView): void {
    this.view = view;
    for (const listener of this.viewListeners) listener(view);
  }

  private notify(notice: Notice): void {
    for (const listener of this.noticeListeners) listener(notice);
  }
}
