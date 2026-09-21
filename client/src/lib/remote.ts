// Sesión remota: la misma interfaz que LocalSession, pero la partida vive en el servidor (API de salas).
// Un comando se envía por POST; lo que hacen los demás se descubre consultando cada ~1,5 s (polling), porque Vercel
// no mantiene WebSockets. Cada vista trae los eventos posteriores a la versión que ya se conoce. Como cada consulta gasta
// un comando de la base, se consulta menos cuando no hace falta: pestaña oculta, tu turno y sin actividad del jugador.

import type { Command } from '../engine';
import type { RoomView, ViewEvent } from '../server/view';
import type { ApiError, RoomsApi } from './roomsApi';
import type { GameSession, SendResult } from './session';

export const POLL_MS = 1500;
export const HIDDEN_POLL_MS = 20000; // con la pestaña oculta: casi no se consulta (cada consulta gasta un comando de la base)
export const MY_TURN_POLL_MS = 15000; // en tu turno nada cambia hasta que actúes: solo una consulta de respaldo
export const IDLE_MS = 5 * 60 * 1000; // sin tocar la pantalla este tiempo, el polling se pausa hasta la próxima actividad

export interface PollOptions {
  myTurnMs?: number;
  idleMs?: number;
}

type Listener = (view: RoomView, events: ViewEvent[]) => void;

export class RemoteSession implements GameSession {
  private current: RoomView | null = null;
  private version = 0;
  private listeners = new Set<Listener>();
  private errorListeners = new Set<(status: number, error: ApiError) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private hidden = false; // pestaña oculta: se consulta mucho más despacio
  private inflight = false; // hay una consulta en curso
  private visibleMs = POLL_MS;
  private hiddenMs = HIDDEN_POLL_MS;
  private myTurnMs = MY_TURN_POLL_MS;
  private idleMs = IDLE_MS;
  private lastActivity = Date.now();
  private paused = false; // pausado por inactividad: `touch()` lo retoma
  private sending = false;
  private epoch = 0; // sube cada vez que se envía un comando: una consulta que empezó antes ya no vale

  constructor(
    readonly roomId: string,
    private token: string,
    private api: RoomsApi,
  ) {}

  /** Primera consulta: deja la vista lista sin notificar (al volver a entrar se recupera el estado exacto, no se repite la partida). */
  async load(): Promise<{ ok: true; view: RoomView } | { ok: false; status: number; error: ApiError }> {
    const r = await this.api.view(this.roomId, this.token, 0);
    if (!r.ok) return r;
    this.current = r.value;
    this.version = r.value.version;
    return { ok: true, view: r.value };
  }

  view(): RoomView {
    if (!this.current) throw new Error('RemoteSession: falta llamar a load()');
    return this.current;
  }

  async send(cmd: Command): Promise<SendResult> {
    this.sending = true;
    this.epoch++;
    try {
      const r = await this.api.command(this.roomId, this.token, cmd);
      if (!r.ok) return { ok: false, error: r.error };
      const known = this.version;
      this.current = r.value;
      this.version = Math.max(this.version, r.value.version);
      if (isFinished(r.value)) this.stop(); // terminó la partida: nada más que consultar
      // la respuesta trae también lo que hicieron los bots a continuación; no se vuelve a entregar por polling
      return { ok: true, events: r.value.events.filter((e) => e.version > known).map((e) => e.event) };
    } finally {
      this.sending = false;
      this.epoch++;
      this.touch(); // enviar es actividad; y con el turno cambiado el intervalo puede ser otro, sin esperar el anterior
      if (this.running && !this.paused && !this.inflight) this.schedule(this.currentInterval());
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Errores del polling (sala inexistente, token ajeno, sin conexión). No se cortan solos: la página decide qué hacer. */
  onError(fn: (status: number, error: ApiError) => void): () => void {
    this.errorListeners.add(fn);
    return () => this.errorListeners.delete(fn);
  }

  /** Una consulta ahora. La usa el polling y los tests. */
  async refresh(): Promise<void> {
    if (this.sending) return;
    const epoch = this.epoch;
    this.inflight = true;
    let r;
    try {
      r = await this.api.view(this.roomId, this.token, this.version);
    } finally {
      this.inflight = false;
    }
    if (epoch !== this.epoch || this.sending) return; // mientras tanto se envió un comando: esa respuesta ya no aplica
    if (!r.ok) {
      this.errorListeners.forEach((fn) => fn(r.status, r.error));
      if (r.status === 404 || r.status === 401) this.stop(); // sala perdida o token que ya no vale: insistir solo gasta consultas
      return;
    }
    if (r.value.version <= this.version) return; // nada nuevo
    const fresh = r.value.events.filter((e) => e.version > this.version).map((e) => e.event);
    this.current = r.value;
    this.version = r.value.version;
    this.listeners.forEach((fn) => fn(r.value, fresh));
    if (isFinished(r.value)) this.stop(); // terminó la partida: no cambia más
  }

  /** Empieza a consultar. Al terminar la partida, o si la sala se pierde, se detiene sola. */
  start(intervalMs = POLL_MS, hiddenMs = HIDDEN_POLL_MS, opts: PollOptions = {}): void {
    if (this.running) return;
    this.running = true;
    this.visibleMs = intervalMs;
    this.hiddenMs = hiddenMs;
    this.myTurnMs = opts.myTurnMs ?? MY_TURN_POLL_MS;
    this.idleMs = opts.idleMs ?? IDLE_MS;
    this.lastActivity = Date.now();
    this.paused = false;
    this.schedule(this.currentInterval());
  }

  /** El jugador tocó la pantalla (mouse, toque, teclado). Si el polling estaba pausado por inactividad, retoma con una consulta ya. */
  touch(): void {
    this.lastActivity = Date.now();
    if (this.running && this.paused) {
      this.paused = false;
      if (!this.inflight) this.schedule(0);
    }
  }

  /** La pestaña se ocultó o volvió a verse. Al volver se consulta enseguida, para no mostrar un estado viejo. */
  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (!hidden) this.touch(); // volver a la pestaña es actividad (y retoma si estaba pausado)
    if (this.running && !hidden && !this.inflight) this.schedule(0);
  }

  private currentInterval(): number {
    if (this.hidden) return this.hiddenMs;
    if (this.current?.game?.trade) return this.visibleMs; // con una oferta abierta se espera a otras personas (o te esperan a vos): consulta al ritmo normal
    return (this.current?.legal.length ?? 0) > 0 ? this.myTurnMs : this.visibleMs; // con jugadas legales, solo vos podés mover
  }

  private schedule(delay: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.refresh();
      if (!this.running) return;
      if (Date.now() - this.lastActivity > this.idleMs) this.paused = true; // nadie mira: se deja de gastar consultas
      else this.schedule(this.currentInterval());
    }, delay);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

function isFinished(view: RoomView): boolean {
  return view.game?.phase.kind === 'finished';
}
