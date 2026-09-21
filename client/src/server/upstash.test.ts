// UpstashStore contra un Upstash simulado (sin red). El simulado entiende GET, DEL y los dos scripts Lua del almacén, que
// reproduce en JavaScript con la misma lógica: prueba el contrato HTTP (autenticación, forma de los comandos, TTL, errores)
// y el uso desde el servicio de salas. La atomicidad real de los scripts se prueba contra la base de verdad en
// upstash.live.test.ts (npm run test:upstash).

import { describe, expect, it } from 'vitest';
import { api } from './api';
import { addBot, createRoom, getView, joinRoom, startGame, submitCommand } from './rooms';
import type { Room } from './room';
import { CREATE_SCRIPT, SAVE_SCRIPT, UpstashStore } from './upstash';

const URL0 = 'https://fake-db.upstash.io';
const TOKEN = 'token-de-prueba';

function fakeUpstash() {
  const data = new Map<string, { value: string; ttl: number | null }>();
  const seen: { command: (string | number)[]; auth: string | null }[] = [];
  let fail: string | null = null;
  const fetchFn = async (input: string, init: RequestInit): Promise<Response> => {
    if (input !== URL0) return new Response('{}', { status: 404 });
    const command = JSON.parse(init.body as string) as (string | number)[];
    seen.push({ command, auth: new Headers(init.headers).get('authorization') });
    if (fail) return Response.json({ error: fail }, { status: 400 });
    if (new Headers(init.headers).get('authorization') !== `Bearer ${TOKEN}`) return Response.json({ error: 'WRONGPASS' }, { status: 401 });
    const [name, ...rest] = command;
    let result: unknown;
    if (name === 'GET') result = data.get(String(rest[0]))?.value ?? null;
    else if (name === 'DEL') result = rest.filter((k) => data.delete(String(k))).length;
    else if (name === 'EVAL') {
      const [script, , k1, k2, ...args] = rest as string[];
      if (script === CREATE_SCRIPT) {
        if (data.has(k1)) result = 0;
        else {
          data.set(k1, { value: args[0], ttl: Number(args[2]) });
          data.set(k2, { value: String(args[1]), ttl: Number(args[2]) });
          result = 1;
        }
      } else if (script === SAVE_SCRIPT) {
        if (data.get(k2)?.value !== String(args[1])) result = 0;
        else {
          data.set(k1, { value: args[0], ttl: Number(args[3]) });
          data.set(k2, { value: String(args[2]), ttl: Number(args[3]) });
          result = 1;
        }
      } else return Response.json({ error: 'script desconocido' }, { status: 400 });
    } else return Response.json({ error: `comando desconocido ${String(name)}` }, { status: 400 });
    return Response.json({ result });
  };
  return { data, seen, fetchFn, failWith: (m: string | null) => void (fail = m) };
}

const newStore = (fake = fakeUpstash(), token = TOKEN) => ({ fake, store: new UpstashStore({ url: URL0 + '/', token, fetchFn: fake.fetchFn }) });

const room = (id: string, version = 1): Room => ({ id, status: 'lobby', seats: [{ name: 'Ana', tokenHash: 'h', bot: false }], state: null, log: [], version });

describe('UpstashStore', () => {
  it('crea, lee y guarda con control de versión', async () => {
    const { store } = newStore();
    expect(await store.get('ABC123')).toBeNull();
    expect(await store.create(room('ABC123'))).toBe(true);
    expect(await store.create(room('ABC123'))).toBe(false); // ya existe
    expect(await store.get('ABC123')).toEqual(room('ABC123'));

    expect(await store.save(room('ABC123', 2), 1)).toBe(true);
    expect(await store.save(room('ABC123', 3), 1)).toBe(false); // alguien ya la cambió: la versión guardada es 2
    expect((await store.get('ABC123'))!.version).toBe(2);
    expect(await store.save(room('ZZZZZZ', 2), 1)).toBe(false); // no existe
  });

  it('manda el token, comandos en JSON, las dos claves y el vencimiento de 7 días', async () => {
    const { fake, store } = newStore();
    await store.create(room('ABC123'));
    await store.save(room('ABC123', 2), 1);
    expect(fake.seen.every((c) => c.auth === `Bearer ${TOKEN}`)).toBe(true);
    const create = fake.seen[0].command;
    expect(create.slice(0, 3)).toEqual(['EVAL', CREATE_SCRIPT, 2]);
    expect(create.slice(3, 5)).toEqual(['paisano:sala:ABC123', 'paisano:sala:ABC123:v']);
    expect(create[7]).toBe(7 * 24 * 60 * 60);
    expect(fake.data.get('paisano:sala:ABC123:v')!.value).toBe('2');
  });

  it('un error de la base (credenciales mal puestas, comando rechazado) se lanza con un mensaje claro', async () => {
    const wrong = newStore(undefined, 'otro-token');
    await expect(wrong.store.get('ABC123')).rejects.toThrow(/WRONGPASS/);
    const { fake, store } = newStore();
    fake.failWith('ERR algo salió mal');
    await expect(store.create(room('ABC123'))).rejects.toThrow(/ERR algo salió mal/);
  });

  it('delete borra las dos claves', async () => {
    const { fake, store } = newStore();
    await store.create(room('ABC123'));
    await store.delete('ABC123');
    expect(fake.data.size).toBe(0);
  });
});

describe('el servicio de salas sobre Upstash', () => {
  it('flujo completo: crear, unirse, bot, empezar, jugar y ver', async () => {
    const { store } = newStore();
    const ana = await createRoom(store, 'Ana');
    if (!ana.ok) throw new Error('create');
    const beto = await joinRoom(store, ana.value.roomId, 'Beto');
    if (!beto.ok) throw new Error('join');
    await addBot(store, ana.value.roomId, ana.value.token);
    const started = await startGame(store, ana.value.roomId, ana.value.token, { seed: 8 });
    expect(started.ok).toBe(true);
    const view = await getView(store, ana.value.roomId, ana.value.token);
    if (!view.ok) throw new Error('view');
    const a = view.value.legal[0];
    const played = await submitCommand(store, ana.value.roomId, ana.value.token, { type: 'placeSettlement', player: 0, vertex: (a as { vertices: number[] }).vertices[0] });
    expect(played.ok && played.value.events.map((e) => e.event.type)).toEqual(['SettlementBuilt']);
    expect(JSON.stringify(view.value)).not.toContain('seed'); // la vista sigue filtrada
  });

  it('dos comandos a la vez: se guarda uno y el otro se revalida contra el estado nuevo', async () => {
    const { store } = newStore();
    const ana = await createRoom(store, 'Ana');
    if (!ana.ok) throw new Error('create');
    await joinRoom(store, ana.value.roomId, 'Beto');
    await addBot(store, ana.value.roomId, ana.value.token);
    await startGame(store, ana.value.roomId, ana.value.token, { seed: 8 });
    const view = await getView(store, ana.value.roomId, ana.value.token);
    if (!view.ok) throw new Error('view');
    const cmd = { type: 'placeSettlement' as const, player: 0, vertex: (view.value.legal[0] as { vertices: number[] }).vertices[0] };
    const [x, y] = await Promise.all([submitCommand(store, ana.value.roomId, ana.value.token, cmd), submitCommand(store, ana.value.roomId, ana.value.token, cmd)]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
  });
});

describe('si el almacén falla', () => {
  it('la API responde 503 con un mensaje claro, no un error de servidor sin cuerpo', async () => {
    const { fake, store } = newStore();
    fake.failWith('la base está caída');
    const res = await api.create(store, new Request('http://test/api/rooms', { method: 'POST', body: JSON.stringify({ name: 'Ana' }) }));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('storage');
    const view = await api.view(store, new Request('http://test/api/rooms/ABC123'), 'ABC123');
    expect(view.status).toBe(503);
  });
});
