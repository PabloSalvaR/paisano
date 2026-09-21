// Sesión remota: la misma interfaz que LocalSession, pero la partida vive en el servidor (API de salas).
// Un comando se envía por POST; lo que hacen los demás se descubre consultando cada ~1,5 s (polling), porque Vercel
// no mantiene WebSockets. Cada vista trae los eventos posteriores a la versión que ya se conoce.

import type { Command } from '../engine';
import type { RoomView, ViewEvent } from '../server/view';
import type { ApiError, RoomsApi } from './roomsApi';
import type { GameSession, SendResult } from './session';

export const POLL_MS = 1500;

type Listener = (view: RoomView, events: ViewEvent[]) => void;

export class RemoteSession implements GameSession {
  private current: RoomView | null = null;
  private version = 0;
  private listeners = new Set<Listener>();
  private errorListeners = new Set<(status: number, error: ApiError) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
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
      // la respuesta trae también lo que hicieron los bots a continuación; no se vuelve a entregar por polling
      return { ok: true, events: r.value.events.filter((e) => e.version > known).map((e) => e.event) };
    } finally {
      this.sending = false;
      this.epoch++;
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
    const r = await this.api.view(this.roomId, this.token, this.version);
    if (epoch !== this.epoch || this.sending) return; // mientras tanto se envió un comando: esa respuesta ya no aplica
    if (!r.ok) {
      this.errorListeners.forEach((fn) => fn(r.status, r.error));
      return;
    }
    if (r.value.version <= this.version) return; // nada nuevo
    const fresh = r.value.events.filter((e) => e.version > this.version).map((e) => e.event);
    this.current = r.value;
    this.version = r.value.version;
    this.listeners.forEach((fn) => fn(r.value, fresh));
  }

  start(intervalMs = POLL_MS): void {
    if (this.running) return;
    this.running = true;
    const tick = async () => {
      await this.refresh();
      if (this.running) this.timer = setTimeout(tick, intervalMs);
    };
    this.timer = setTimeout(tick, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
