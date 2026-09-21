// Almacén de salas sobre Upstash Redis, hablando con su API REST por HTTP (sin librería: es un POST con el comando en JSON).
// Cada sala son dos claves: el documento (JSON) y su número de versión. Crear y guardar-si-la-versión-no-cambió son
// scripts Lua, que Redis ejecuta de forma atómica: así dos peticiones a la vez no se pisan. Las salas vencen a los 7 días
// sin actividad (cada guardado renueva el plazo), para que la base gratuita no se llene de partidas viejas.

import type { Room } from './room';
import type { RoomStore } from './store';

export interface UpstashConfig {
  url: string;
  token: string;
  prefix?: string;
  ttlSeconds?: number;
  fetchFn?: (input: string, init: RequestInit) => Promise<Response>;
}

export const CREATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1`;

export const SAVE_SCRIPT = `
if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return 1`;

const DEFAULT_TTL = 7 * 24 * 60 * 60;

export class UpstashStore implements RoomStore {
  private url: string;
  private token: string;
  private prefix: string;
  private ttl: number;
  private fetchFn: (input: string, init: RequestInit) => Promise<Response>;

  constructor(cfg: UpstashConfig) {
    this.url = cfg.url.replace(/\/+$/, '');
    this.token = cfg.token;
    this.prefix = cfg.prefix ?? 'paisano:sala:';
    this.ttl = cfg.ttlSeconds ?? DEFAULT_TTL;
    this.fetchFn = cfg.fetchFn ?? ((input, init) => fetch(input, init));
  }

  private docKey = (id: string): string => `${this.prefix}${id}`;
  private verKey = (id: string): string => `${this.prefix}${id}:v`;

  /** Un comando de Redis: `["GET", "clave"]`. Lanza si la base no responde o rechaza el comando. */
  private async run<T>(command: (string | number)[]): Promise<T> {
    const res = await this.fetchFn(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`Upstash: ${body.error ?? `HTTP ${res.status}`}`);
    return body.result as T;
  }

  async get(id: string): Promise<Room | null> {
    const raw = await this.run<string | null>(['GET', this.docKey(id)]);
    return raw ? (JSON.parse(raw) as Room) : null;
  }

  async create(room: Room): Promise<boolean> {
    const r = await this.run<number>(['EVAL', CREATE_SCRIPT, 2, this.docKey(room.id), this.verKey(room.id), JSON.stringify(room), room.version, this.ttl]);
    return r === 1;
  }

  async save(room: Room, expectedVersion: number): Promise<boolean> {
    const r = await this.run<number>(['EVAL', SAVE_SCRIPT, 2, this.docKey(room.id), this.verKey(room.id), JSON.stringify(room), expectedVersion, room.version, this.ttl]);
    return r === 1;
  }

  /** Borra una sala (para los tests contra la base real). */
  async delete(id: string): Promise<void> {
    await this.run<number>(['DEL', this.docKey(id), this.verKey(id)]);
  }
}
