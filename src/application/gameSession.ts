import { summarize, type MatchSummary } from '../domain/match';
import { STALE_PLAYER_MS, isAlone, opponentStatus, slotOf, type Room } from '../domain/room';
import { opponentOf, type Move, type PlayerId, type PlayerSlot, type RoomCode } from '../domain/types';
import { createRoom } from './createRoom';
import { joinRoom } from './joinRoom';
import { leaveRoom } from './leaveRoom';
import { commitMove, isPendingFor, revealMove, type RoundContext } from './playMove';
import type { Clock, Identity, Random, RoomGateway, SessionStore, Unsubscribe } from './ports';
import { acceptReset, dismissReset, requestReset, startFreshMatch } from './resetMatch';
import { buildPlayingView, type GameView, type Notice } from './view';

export interface GameSessionDeps {
  identity: Identity;
  gateway: RoomGateway;
  clock: Clock;
  random: Random;
  store: SessionStore;
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
    this.player = await this.deps.identity.ensurePlayer();
    const saved = this.deps.store.loadRoom();
    if (inviteCode) await this.enter(inviteCode, { showErrors: true });
    else if (saved) await this.enter(saved, { showErrors: false });
    else this.goHome(null);
  }

  async createRoom(): Promise<void> {
    const player = this.requirePlayer();
    this.setView({ screen: 'home', busy: true, error: null });
    try {
      const code = await createRoom(this.deps, player);
      this.attach(code);
    } catch {
      this.goHome('unexpected');
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
    const player = this.requirePlayer();
    this.setView({ screen: 'home', busy: true, error: null });
    try {
      const result = await joinRoom(this.deps, input, player);
      if (result.ok) {
        this.attach(result.code);
        return;
      }
      this.forgetRoom();
      this.goHome(showErrors ? result.error : null);
    } catch {
      this.forgetRoom();
      this.goHome(showErrors ? 'unexpected' : null);
    }
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
    const opponent = opponentOf(slot);
    const before = previous.players[opponent]?.id;
    const after = room.players[opponent]?.id;
    if (after && after !== before) this.notify('opponent-joined');
    else if (before && !after) this.notify('opponent-left');

    const me = this.requirePlayer();
    if (previous.resetRequest?.by === me && !room.resetRequest) {
      if (room.currentMatch !== previous.currentMatch) this.notify('reset-accepted');
      else if (!this.cancelledMyReset) this.notify('reset-declined');
      this.cancelledMyReset = false;
    }
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
      this.setView({ screen: 'waiting', code: room.code });
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
    if (summary.current.phase === 'revealing' && summary.current.deadline !== null) {
      deadlines.push(summary.current.deadline);
    }
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
    return summarize(room.rounds, { now: this.deps.clock.now() });
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

  private requirePlayer(): PlayerId {
    if (!this.player) throw new Error('Sessão não iniciada: chame start() antes.');
    return this.player;
  }

  private goHome(error: Extract<GameView, { screen: 'home' }>['error']): void {
    this.setView({ screen: 'home', busy: false, error });
  }

  private setView(view: GameView): void {
    this.view = view;
    for (const listener of this.viewListeners) listener(view);
  }

  private notify(notice: Notice): void {
    for (const listener of this.noticeListeners) listener(notice);
  }
}
