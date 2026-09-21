// RemoteSession contra la API real (handlers de server/api.ts + almacén en memoria) detrás de un fetch falso.

import { describe, expect, it } from 'vitest';
import { randomBot } from '../bots/random';
import { mulberry32 } from '../engine';
import type { Command } from '../engine';
import { api } from '../server/api';
import { MemoryStore } from '../server/store';
import type { ViewEvent } from '../server/view';
import { forgetIdentity, lastName, loadIdentity, saveIdentity } from './identity';
import { RemoteSession } from './remote';
import { roomsApi, type FetchFn } from './roomsApi';

function fakeFetch(store: MemoryStore): FetchFn & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (input: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`);
    const req = new Request(new URL(input, 'http://test'), init);
    const m = /^\/api\/rooms(?:\/([^/?]+)(?:\/(join|bots|start|command))?)?/.exec(input);
    if (!m) return new Response('{}', { status: 404 });
    const [, id, action] = m;
    if (!id) return api.create(store, req);
    if (action === 'join') return api.join(store, req, id);
    if (action === 'bots') return api.addBot(store, req, id);
    if (action === 'start') return api.start(store, req, id);
    if (action === 'command') return api.command(store, req, id);
    return api.view(store, req, id);
  }) as FetchFn & { calls: string[] };
  f.calls = calls;
  return f;
}

async function setup(humans: 1 | 2, bots: number) {
  const store = new MemoryStore(new Map());
  const fetchFn = fakeFetch(store);
  const client = roomsApi(fetchFn);
  const created = await client.create('Ana');
  if (!created.ok) throw new Error('create');
  const { roomId, token } = created.value;
  let betoToken = '';
  if (humans === 2) {
    const j = await client.join(roomId, 'Beto');
    if (!j.ok) throw new Error('join');
    betoToken = j.value.token;
  }
  for (let i = 0; i < bots; i++) await client.addBot(roomId, token);
  const started = await client.start(roomId, token);
  if (!started.ok) throw new Error('start ' + started.error.message);
  const ana = new RemoteSession(roomId, token, client);
  await ana.load();
  const beto = humans === 2 ? new RemoteSession(roomId, betoToken, client) : null;
  await beto?.load();
  return { store, fetchFn, client, roomId, token, ana, beto };
}

const firstSetupCmd = (legal: { type: string; vertices?: number[]; edges?: number[] }[]): Command => {
  const a = legal[0];
  return a.type === 'placeSettlement' ? { type: 'placeSettlement', player: 0, vertex: a.vertices![0] } : { type: 'placeRoad', player: 0, edge: a.edges![0] };
};

describe('RemoteSession', () => {
  it('load deja la vista lista sin notificar, y volver a entrar recupera el estado exacto', async () => {
    const { client, roomId, token, ana } = await setup(2, 1);
    const seen: ViewEvent[][] = [];
    ana.subscribe((_v, events) => seen.push(events));
    await ana.send(firstSetupCmd(ana.view().legal));
    const again = new RemoteSession(roomId, token, client); // «refrescar la página»
    const r = await again.load();
    expect(r.ok).toBe(true);
    expect(again.view().version).toBe(ana.view().version);
    expect(again.view().game!.vertexBuildings.filter(Boolean)).toHaveLength(1);
    expect(seen).toEqual([]); // enviar un comando propio no notifica por el canal de los demás
  });

  it('lo que hace un jugador le llega al otro por polling, una sola vez y en orden', async () => {
    const { ana, beto } = await setup(2, 1);
    const seen: string[][] = [];
    beto!.subscribe((_v, events) => seen.push(events.map((e) => e.type)));
    const r1 = await ana.send(firstSetupCmd(ana.view().legal));
    expect(r1.ok && r1.events.map((e) => e.type)).toEqual(['SettlementBuilt']);
    await beto!.refresh();
    await beto!.refresh(); // sin novedades: no repite
    await ana.send(firstSetupCmd(ana.view().legal)); // camino
    await beto!.refresh();
    expect(seen).toEqual([['SettlementBuilt'], ['RoadBuilt', 'TurnChanged']]);
    expect(beto!.view().me).toBe(1);
    expect(beto!.view().legal.length).toBeGreaterThan(0); // ahora le toca a Beto
    expect(ana.view().legal).toEqual([]);
  });

  it('una consulta en vuelo mientras se envía no duplica los eventos propios', async () => {
    const { ana } = await setup(2, 1);
    const seen: string[][] = [];
    ana.subscribe((_v, events) => seen.push(events.map((e) => e.type)));
    const cmd = firstSetupCmd(ana.view().legal);
    const [sent] = await Promise.all([ana.send(cmd), ana.refresh()]);
    await ana.refresh();
    expect(sent.ok && sent.events.map((e) => e.type)).toEqual(['SettlementBuilt']);
    expect(seen).toEqual([]);
  });

  it('con bots, la respuesta al comando trae también lo que jugaron ellos', async () => {
    const { ana } = await setup(1, 2);
    await ana.send(firstSetupCmd(ana.view().legal));
    const r = await ana.send(firstSetupCmd(ana.view().legal));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const built = r.events.filter((e) => e.type === 'SettlementBuilt').map((e) => (e as { player: number }).player);
    expect(built).toEqual([1, 2, 2, 1]); // serpentina con 3 jugadores: 0, 1, 2, 2, 1, 0
    expect(ana.view().game!.turn).toBe(0);
  });

  it('una partida completa contra bots por la API, comando por comando', async () => {
    const { ana } = await setup(1, 2);
    const rng = mulberry32(7);
    let steps = 0;
    for (; steps < 300 && ana.view().game!.phase.kind !== 'finished'; steps++) {
      const v = ana.view();
      expect(v.game!.turn).toBe(0);
      const r = await ana.send(randomBot({ me: 0, legal: v.legal, hand: v.game!.hand }, rng));
      expect(r.ok).toBe(true);
    }
    expect(steps).toBeGreaterThan(50);
  }, 60000);

  it('los errores llegan como resultado, no como excepciones', async () => {
    const { ana } = await setup(2, 1);
    const r = await ana.send({ type: 'rollDice', player: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: 'wrong-phase' } });

    const down = new RemoteSession('ABCDEF', 'x', roomsApi(async () => { throw new Error('sin red'); }));
    expect(await down.load()).toMatchObject({ ok: false, status: 0, error: { code: 'network' } });
    expect(await down.send({ type: 'endTurn', player: 0 })).toMatchObject({ ok: false, error: { code: 'network' } });
  });

  it('avisa los errores del polling (sala inexistente o token ajeno) y no lanza', async () => {
    const { client, roomId, ana } = await setup(1, 2);
    const stranger = new RemoteSession(roomId, 'token-ajeno', client);
    const errs: number[] = [];
    stranger.onError((status) => errs.push(status));
    await stranger.refresh();
    expect(errs).toEqual([401]);
    const lost = new RemoteSession('ZZZZZZ', 'x', client);
    expect((await lost.load()).ok).toBe(false);
    expect(ana.view().roomId).toBe(roomId);
  });

  it('start/stop: el polling consulta solo y se detiene', async () => {
    const { fetchFn, ana, beto } = await setup(2, 1);
    const seen: string[][] = [];
    beto!.subscribe((_v, events) => seen.push(events.map((e) => e.type)));
    beto!.start(10);
    await ana.send(firstSetupCmd(ana.view().legal));
    await new Promise((r) => setTimeout(r, 80));
    beto!.stop();
    const calls = fetchFn.calls.length;
    await new Promise((r) => setTimeout(r, 60));
    expect(seen).toEqual([['SettlementBuilt']]);
    expect(fetchFn.calls.length).toBe(calls); // detenido: no sigue consultando
  });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ahorro de consultas (cada una gasta un comando de la base)', () => {
  it('con la pestaña oculta consulta casi nada, y al volver consulta enseguida', async () => {
    const { fetchFn, beto } = await setup(2, 1);
    const views = () => fetchFn.calls.filter((c) => c.startsWith('GET')).length;
    beto!.start(10, 500);
    await sleep(80);
    expect(views()).toBeGreaterThan(3); // visible: consulta seguido
    beto!.setHidden(true);
    await sleep(40); // termina la consulta en curso
    const hiddenFrom = views();
    await sleep(200);
    expect(views() - hiddenFrom).toBeLessThanOrEqual(1); // oculta: casi no consulta
    const before = views();
    beto!.setHidden(false);
    await sleep(40);
    expect(views()).toBeGreaterThan(before); // al volver, consulta ya (no espera el intervalo largo)
    beto!.stop();
  });

  it('en tu turno consulta despacio (nada cambia hasta que actúes) y al pasar el turno vuelve a consultar seguido', async () => {
    const { fetchFn, ana } = await setup(2, 1);
    const views = () => fetchFn.calls.filter((c) => c.startsWith('GET')).length;
    ana.start(10, 500, { myTurnMs: 500 });
    const from = views();
    await sleep(100);
    expect(views() - from).toBeLessThanOrEqual(1); // le toca a Ana: casi no consulta
    await ana.send(firstSetupCmd(ana.view().legal)); // poblado
    await ana.send(firstSetupCmd(ana.view().legal)); // camino: el turno pasa a Beto
    expect(ana.view().legal).toEqual([]);
    const passed = views();
    await sleep(80);
    expect(views() - passed).toBeGreaterThan(3); // no le toca: consulta seguido, sin esperar el intervalo largo
    ana.stop();
  });

  it('sin actividad del jugador se pausa, y al volver a tocar la pantalla retoma enseguida', async () => {
    const { fetchFn, beto } = await setup(2, 1);
    const views = () => fetchFn.calls.filter((c) => c.startsWith('GET')).length;
    beto!.start(10, 500, { idleMs: 60 });
    await sleep(200);
    const paused = views();
    await sleep(100);
    expect(views()).toBe(paused); // pausado: no consulta
    beto!.touch();
    await sleep(40);
    expect(views()).toBeGreaterThan(paused); // retoma ya
    beto!.stop();
  });

  it('con actividad sostenida no se pausa', async () => {
    const { fetchFn, beto } = await setup(2, 1);
    const views = () => fetchFn.calls.filter((c) => c.startsWith('GET')).length;
    beto!.start(10, 500, { idleMs: 60 });
    for (let i = 0; i < 10; i++) {
      beto!.touch();
      await sleep(20);
    }
    const before = views();
    await sleep(30);
    expect(views()).toBeGreaterThan(before);
    beto!.stop();
  });

  it('deja de consultar cuando la partida terminó (y avisa una sola vez)', async () => {
    const { store, roomId, fetchFn, beto } = await setup(2, 1);
    const seen: string[] = [];
    beto!.subscribe((v) => seen.push(v.game!.phase.kind));
    const room = (await store.get(roomId))!;
    room.state!.phase = { kind: 'finished', winner: 0 };
    expect(await store.save({ ...room, version: room.version + 1 }, room.version)).toBe(true);
    beto!.start(10);
    await sleep(80);
    expect(seen).toEqual(['finished']);
    const after = fetchFn.calls.length;
    await sleep(80);
    expect(fetchFn.calls.length).toBe(after); // detenido
  });

  it('deja de consultar si la sala no existe o el token ya no vale', async () => {
    const { client, roomId, fetchFn } = await setup(1, 2);
    const lost = new RemoteSession('ZZZZZZ', 'x', client);
    const errs: number[] = [];
    lost.onError((status) => errs.push(status));
    lost.start(10);
    await sleep(100);
    expect(errs).toEqual([404]); // una sola vez: después se detuvo

    const stranger = new RemoteSession(roomId, 'token-ajeno', client);
    const errs2: number[] = [];
    stranger.onError((status) => errs2.push(status));
    const before = fetchFn.calls.length;
    stranger.start(10);
    await sleep(100);
    expect(errs2).toEqual([401]);
    expect(fetchFn.calls.length - before).toBe(1);
  });
});

describe('identidad en el navegador', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };

  it('guarda y recupera el token por sala (sin distinguir mayúsculas) y el último nombre', () => {
    const s = memory();
    expect(loadIdentity('ABC123', s)).toBeNull();
    saveIdentity('abc123', { token: 't1', name: 'Ana' }, s);
    expect(loadIdentity('ABC123', s)).toEqual({ token: 't1', name: 'Ana' });
    expect(lastName(s)).toBe('Ana');
    forgetIdentity('ABC123', s);
    expect(loadIdentity('ABC123', s)).toBeNull();
  });

  it('sin almacenamiento, o con datos corruptos, no lanza', () => {
    expect(loadIdentity('ABC123', null)).toBeNull();
    expect(() => saveIdentity('ABC123', { token: 't', name: 'n' }, null)).not.toThrow();
    const broken = { getItem: () => '{no es json', setItem: () => { throw new Error('lleno'); }, removeItem: () => { throw new Error('bloqueado'); } };
    expect(loadIdentity('ABC123', broken)).toBeNull();
    expect(() => saveIdentity('ABC123', { token: 't', name: 'n' }, broken)).not.toThrow();
    expect(() => forgetIdentity('ABC123', broken)).not.toThrow();
    expect(lastName({ getItem: () => { throw new Error('x'); } })).toBe('');
  });
});
