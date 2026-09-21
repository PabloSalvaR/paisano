// Sesión de juego: lo único que el tablero 3D conoce de la partida. Da la última vista del jugador, envía comandos y avisa
// de los cambios. Hay dos implementaciones: `LocalSession` (motor en el navegador, los 3-4 jugadores en la misma pantalla)
// y, más adelante, una remota que habla con la API de salas. La vista es la misma en ambas (`RoomView`).

import { applyCommand, createGame, legalActions } from '../engine';
import type { Command, GameConfig, GameState } from '../engine';
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

export class LocalSession implements GameSession {
  private state: GameState;
  private version = 1;
  private listeners = new Set<(view: RoomView, events: ViewEvent[]) => void>();

  constructor(
    private names: string[],
    seed: number,
    config?: Partial<GameConfig>,
  ) {
    this.state = createGame(names, seed, config);
  }

  /** En la partida local mira quien tiene el turno: es lo mismo que pasaba cuando el tablero leía el estado completo. */
  view(): RoomView {
    const me = this.state.turn;
    return {
      roomId: 'local',
      version: this.version,
      status: 'playing',
      seats: this.names.map((name) => ({ name, bot: false })),
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
    this.version++;
    const events = r.events.map((e) => viewEvent(e, cmd.player));
    this.listeners.forEach((fn) => fn(this.view(), events));
    return { ok: true, events };
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
