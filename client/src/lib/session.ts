// Sesión de juego: lo único que el tablero 3D conoce de la partida. Da la última vista del jugador, envía comandos y avisa
// de los cambios. Hay dos implementaciones: `LocalSession` (motor en el navegador, los 3-4 jugadores en la misma pantalla)
// y, más adelante, una remota que habla con la API de salas. La vista es la misma en ambas (`RoomView`).

import { playBots } from '../bots/play';
import { drawProfiles, PROFILES, type BotProfileId } from '../bots/profiles';
import { makeSmartBot } from '../bots/smart';
import type { Bot } from '../bots/random';
import { applyCommand, createGame, legalActions } from '../engine';
import type { Command, GameConfig, GameEvent, GameState, Rng } from '../engine';
import { gameView, viewEvent, type RoomView, type ViewEvent } from '../server/view';

export type SendResult = { ok: true; events: ViewEvent[] } | { ok: false; error: { code: string; message: string } };

export interface GameSession {
  /** Última vista conocida de quien mira. */
  view(): RoomView;
  /** Envía un comando. La vista se actualiza antes de que la promesa se resuelva. */
  send(cmd: Command): Promise<SendResult>;
  /** Avisa cuando la vista cambia (por un comando propio o, en remoto, por lo que hicieron otros). Devuelve la baja. */
  subscribe(fn: (view: RoomView, events: ViewEvent[]) => void): () => void;
}

export interface LocalOptions {
  /** Qué asientos juegan solos. El primero tiene que ser humano. Sin esto, todos los asientos son de la misma pantalla. */
  bots?: boolean[];
  rng?: Rng;
  bot?: Bot;
  /** 'draw': cada bot saca un perfil distinto (estanciero, colono, balanceado) al crear la sesión; no se muestra en la mesa. */
  profiles?: 'draw';
}

export class LocalSession implements GameSession {
  private state: GameState;
  private version = 1;
  private listeners = new Set<(view: RoomView, events: ViewEvent[]) => void>();
  private profiles: (BotProfileId | null)[] = [];
  private botList?: Bot[];

  constructor(
    private names: string[],
    seed: number,
    config?: Partial<GameConfig>,
    private opts: LocalOptions = {},
  ) {
    if (opts.bots?.[0]) throw new Error('LocalSession: el primer asiento tiene que ser humano');
    this.state = createGame(names, seed, config);
    const bots = opts.bots;
    if (bots && opts.profiles === 'draw') {
      const drawn = drawProfiles(bots.filter(Boolean).length, opts.rng ?? Math.random);
      this.profiles = bots.map((isBot) => (isBot ? drawn.shift()! : null));
      this.botList = this.profiles.map((id) => makeSmartBot(PROFILES[id ?? 'balanced']));
    }
  }

  /** Quién mira: en la partida contra bots, el humano (asiento 0); en la de varios en la misma pantalla, quien tiene el turno. */
  private viewer(): number {
    if (this.opts.bots) return 0;
    // en la misma pantalla, con una oferta abierta mira primero cada jugador consultado y al final quien propuso
    const offer = this.state.trade;
    if (offer) return offer.responses.find((r) => r.status === 'pending')?.player ?? offer.from;
    return this.state.turn;
  }

  view(): RoomView {
    const me = this.viewer();
    return {
      roomId: 'local',
      version: this.version,
      status: 'playing',
      seats: this.names.map((name, i) => ({ name, bot: !!this.opts.bots?.[i] })),
      me,
      game: gameView(this.state, me),
      legal: legalActions(this.state, me),
      events: [],
    };
  }

  async send(cmd: Command): Promise<SendResult> {
    const r = applyCommand(this.state, cmd);
    if (!r.ok) return { ok: false, error: r.error };
    this.state = r.state;
    const all: GameEvent[] = [...r.events];
    const bots = this.opts.bots;
    if (bots) {
      // los bots juegan enseguida, hasta que vuelve a tocarle al humano: sus eventos siguen a los del comando
      const played = playBots(this.state, (p) => bots[p], this.opts.rng ?? Math.random, this.botList ?? this.opts.bot);
      this.state = played.state;
      all.push(...played.events);
    }
    this.version++;
    const who = this.opts.bots ? 0 : this.viewer(); // en la misma pantalla mira quien tiene que actuar ahora; contra bots, el humano
    const events = all.map((e) => viewEvent(e, who));
    this.listeners.forEach((fn) => fn(this.view(), events));
    return { ok: true, events };
  }

  /**
   * Si el sorteo le dio la apertura a un bot, que juegue hasta que le toque al humano. Lo llama el tablero cuando termina de mostrar
   * el sorteo; devuelve los eventos para reproducirlos como cualquier otra jugada.
   */
  async kick(): Promise<ViewEvent[]> {
    const bots = this.opts.bots;
    if (!bots || !bots[this.state.turn] || this.state.phase.kind === 'finished') return [];
    const played = playBots(this.state, (p) => bots[p], this.opts.rng ?? Math.random, this.botList ?? this.opts.bot);
    this.state = played.state;
    this.version++;
    return played.events.map((e) => viewEvent(e, 0));
  }

  subscribe(fn: (view: RoomView, events: ViewEvent[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------------------------------------------------------------- solo desarrollo

  /** Completa la colocación inicial con comandos legales; `choose` elige entre las opciones (vértices o aristas). */
  autoSetup(choose: (options: number[], isVertex: boolean) => number): void {
    for (let guard = 0; this.state.phase.kind === 'setup' && guard < 200; guard++) {
      const p = this.state.turn;
      const a = legalActions(this.state, p)[0];
      const vertex = a.type === 'placeSettlement';
      const at = choose(vertex ? a.vertices : a.type === 'placeRoad' ? a.edges : [], vertex);
      const r = applyCommand(this.state, vertex ? { type: 'placeSettlement', player: p, vertex: at } : { type: 'placeRoad', player: p, edge: at });
      if (!r.ok) break;
      this.state = r.state;
    }
    this.version++;
  }

  /** El perfil de cada asiento (null: humano o sin sortear): solo para pruebas; en la mesa no se muestra. */
  debugProfiles(): (BotProfileId | null)[] {
    return this.state.players.map((_, p) => this.profiles[p] ?? null);
  }

  /** Estado completo (con manos y semillas): solo para el gancho de pruebas `?debug`. */
  debugState(): GameState {
    return this.state;
  }

  /** Arma situaciones a mano (dar cartas, cambiar de fase) sobre una copia del estado. */
  debugMutate(fn: (s: GameState) => void): void {
    this.state = JSON.parse(JSON.stringify(this.state)) as GameState;
    fn(this.state);
    this.version++;
  }
}
