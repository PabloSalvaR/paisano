// Cliente de la API de salas (lo que llama el navegador). Recibe `fetch` para poder probarlo sin red ni servidor.

import type { Command } from '../engine';
import type { RoomView } from '../server/view';

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; error: ApiError };

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface RoomsApi {
  create(name: string): Promise<ApiResult<{ roomId: string; token: string }>>;
  join(roomId: string, name: string): Promise<ApiResult<{ token: string; seat: number }>>;
  addBot(roomId: string, token: string): Promise<ApiResult<RoomView>>;
  start(roomId: string, token: string): Promise<ApiResult<RoomView>>;
  command(roomId: string, token: string, command: Command): Promise<ApiResult<RoomView>>;
  view(roomId: string, token: string, since: number): Promise<ApiResult<RoomView>>;
}

export function roomsApi(fetchFn: FetchFn = (input, init) => fetch(input, init)): RoomsApi {
  async function call<T>(method: 'GET' | 'POST', path: string, token?: string, body?: unknown): Promise<ApiResult<T>> {
    try {
      const res = await fetchFn(path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
      const json = (await res.json()) as unknown;
      if (res.ok) return { ok: true, value: json as T };
      const error = (json as { error?: ApiError }).error;
      return { ok: false, status: res.status, error: error ?? { code: 'http', message: `Error ${res.status}` } };
    } catch {
      return { ok: false, status: 0, error: { code: 'network', message: 'Sin conexión con el servidor.' } };
    }
  }
  const room = (id: string) => `/api/rooms/${encodeURIComponent(id)}`;
  return {
    create: (name) => call('POST', '/api/rooms', undefined, { name }),
    join: (id, name) => call('POST', `${room(id)}/join`, undefined, { name }),
    addBot: (id, token) => call('POST', `${room(id)}/bots`, token),
    start: (id, token) => call('POST', `${room(id)}/start`, token),
    command: (id, token, command) => call('POST', `${room(id)}/command`, token, { command }),
    view: (id, token, since) => call('GET', `${room(id)}?since=${since}`, token),
  };
}
