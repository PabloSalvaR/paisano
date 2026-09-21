// Prueba contra la base Upstash de verdad. Se salta sola si no hay credenciales, así `npm test` no necesita red.
// Correr con: npm run test:upstash  (lee client/.env.local con las variables UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN)
// Usa un prefijo propio y salas con vencimiento corto: no toca ninguna partida real.

import { afterAll, describe, expect, it } from 'vitest';
import { addBot, createRoom, getView, joinRoom, startGame, submitCommand } from './rooms';
import type { Room } from './room';
import { UpstashStore } from './upstash';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

describe.skipIf(!url || !token)('Upstash de verdad', () => {
  const prefix = `paisano:test:${Date.now()}:`;
  const store = new UpstashStore({ url: url ?? '', token: token ?? '', prefix, ttlSeconds: 120 }); // sin credenciales la suite se salta y esto no se usa
  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await store.delete(id);
  });

  const room = (id: string, version = 1): Room => ({ id, status: 'lobby', seats: [{ name: 'Ana', tokenHash: 'h', bot: false }], state: null, log: [], version });

  it('crear, leer y guardar con control de versión', async () => {
    created.push('AAAAAA');
    expect(await store.get('AAAAAA')).toBeNull();
    expect(await store.create(room('AAAAAA'))).toBe(true);
    expect(await store.create(room('AAAAAA'))).toBe(false);
    expect((await store.get('AAAAAA'))!.seats[0].name).toBe('Ana');
    expect(await store.save(room('AAAAAA', 2), 1)).toBe(true);
    expect(await store.save(room('AAAAAA', 3), 1)).toBe(false);
    expect((await store.get('AAAAAA'))!.version).toBe(2);
  });

  it('guardados simultáneos: gana uno solo (atomicidad del script)', async () => {
    created.push('BBBBBB');
    await store.create(room('BBBBBB'));
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => store.save({ ...room('BBBBBB', 2), seats: [{ name: `N${i}`, tokenHash: 'h', bot: false }] }, 1)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await store.get('BBBBBB'))!.version).toBe(2);
  });

  it('una partida real por el servicio: crear, unirse, bot, empezar, jugar; dos comandos a la vez', async () => {
    const ana = await createRoom(store, 'Ana');
    if (!ana.ok) throw new Error('create');
    created.push(ana.value.roomId);
    const beto = await joinRoom(store, ana.value.roomId, 'Beto');
    expect(beto.ok).toBe(true);
    await addBot(store, ana.value.roomId, ana.value.token);
    expect((await startGame(store, ana.value.roomId, ana.value.token, { seed: 8 })).ok).toBe(true);
    const view = await getView(store, ana.value.roomId, ana.value.token);
    if (!view.ok) throw new Error('view');
    const cmd = { type: 'placeSettlement' as const, player: 0, vertex: (view.value.legal[0] as { vertices: number[] }).vertices[0] };
    const [x, y] = await Promise.all([submitCommand(store, ana.value.roomId, ana.value.token, cmd), submitCommand(store, ana.value.roomId, ana.value.token, cmd)]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
    const after = await getView(store, ana.value.roomId, ana.value.token);
    expect(after.ok && after.value.game!.vertexBuildings.filter(Boolean)).toHaveLength(1);
  });
});
