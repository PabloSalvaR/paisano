import { describe, expect, it } from 'vitest';
import { api, parseCommand } from './api';
import { gameDefaults } from './rooms';
import { MemoryStore } from './store';

gameDefaults.firstPlayer = 0; // los tests suponen que abre quien creó la sala

const URL0 = 'http://localhost/api/rooms';
const newStore = () => new MemoryStore(new Map());

const post = (body?: unknown, token?: string) =>
  new Request(URL0, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (token?: string, query = '') => new Request(`${URL0}/X${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function json(res: Response): Promise<any> {
  return res.json();
}

/** Sala con Ana (anfitriona), Beto y un bot, ya empezada. */
async function started() {
  const store = newStore();
  const ana = await json(await api.create(store, post({ name: 'Ana' })));
  const beto = await json(await api.join(store, post({ name: 'Beto' }), ana.roomId));
  await api.addBot(store, post(undefined, ana.token), ana.roomId);
  const start = await api.start(store, post(undefined, ana.token), ana.roomId);
  return { store, id: ana.roomId as string, ana: ana.token as string, beto: beto.token as string, start };
}

describe('endpoints', () => {
  it('flujo completo: crear, unirse, sumar bot, empezar, ver y jugar', async () => {
    const { store, id, ana, beto, start } = await started();
    expect(start.status).toBe(200);
    const view = await json(await api.view(store, get(ana), id));
    expect(view).toMatchObject({ status: 'playing', me: 0 });
    expect(view.seats.map((s: any) => s.name)).toEqual(['Ana', 'Beto', 'Bot 1']);
    const vertex = view.legal[0].vertices[0];
    const played = await api.command(store, post({ command: { type: 'placeSettlement', vertex } }, ana), id);
    expect(played.status).toBe(200);
    expect((await json(played)).events.map((e: any) => e.event.type)).toEqual(['SettlementBuilt']);
    const betoView = await json(await api.view(store, get(beto, '?since=0'), id));
    expect(betoView).toMatchObject({ me: 1 });
    expect(betoView.events).toHaveLength(1);
  });

  it('no se cachea y no filtra secretos en el JSON', async () => {
    const { store, id, ana } = await started();
    const res = await api.view(store, get(ana), id);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(text).not.toContain('seed');
    expect(text).not.toContain('tokenHash');
  });

  it('el código de sala se acepta en minúsculas', async () => {
    const { store, id, ana } = await started();
    expect((await api.view(store, get(ana), id.toLowerCase())).status).toBe(200);
  });

  it('códigos de estado: 404 sala inexistente, 401 sin token o ajeno, 403 no anfitrión, 400 error de reglas', async () => {
    const { store, id, ana, beto } = await started();
    expect((await api.view(store, get(ana), 'ZZZZZZ')).status).toBe(404);
    expect((await api.view(store, get(), id)).status).toBe(401);
    expect((await api.view(store, get('ajeno'), id)).status).toBe(401);
    expect((await api.addBot(store, post(undefined, beto), id)).status).toBe(403);
    const illegal = await api.command(store, post({ command: { type: 'rollDice' } }, ana), id);
    expect(illegal.status).toBe(400);
    expect((await json(illegal)).error.code).toBe('wrong-phase');
    const notMyTurn = await api.command(store, post({ command: { type: 'placeSettlement', vertex: 0 } }, beto), id);
    expect((await json(notMyTurn)).error.code).toBe('not-your-turn');
  });

  it('cuerpos mal formados dan 400 y no lanzan', async () => {
    const { store, id, ana } = await started();
    const bad = [post('esto no es json', ana), post({}, ana), post({ command: 'x' }, ana), post({ command: { type: 'hackear' } }, ana), post({ command: { type: 'buildRoad', edge: 'uno' } }, ana)];
    for (const req of bad) {
      const res = await api.command(store, req, id);
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe('invalid-command');
    }
    expect((await api.create(store, post('no json'))).status).toBe(400);
    expect((await api.join(store, post({ name: 42 }), id)).status).toBe(400);
  });
});

describe('parseCommand', () => {
  it('acepta las formas válidas y pone player en 0 (el servidor lo reemplaza)', () => {
    expect(parseCommand({ type: 'placeRoad', edge: 3, player: 9 })).toEqual({ type: 'placeRoad', player: 0, edge: 3 });
    expect(parseCommand({ type: 'bankTrade', give: 'forest', get: 'fields' })).toEqual({ type: 'bankTrade', player: 0, give: 'forest', get: 'fields' });
    expect(parseCommand({ type: 'discard', cards: { forest: 2, hills: 1 } })).toEqual({ type: 'discard', player: 0, cards: { forest: 2, hills: 1 } });
    expect(parseCommand({ type: 'endTurn' })).toEqual({ type: 'endTurn', player: 0 });
  });

  it('acepta los comandos de las cartas de desarrollo', () => {
    expect(parseCommand({ type: 'buyDevCard', player: 3 })).toEqual({ type: 'buyDevCard', player: 0 });
    expect(parseCommand({ type: 'playKnight' })).toEqual({ type: 'playKnight', player: 0 });
    expect(parseCommand({ type: 'playRoadBuilding' })).toEqual({ type: 'playRoadBuilding', player: 0 });
    expect(parseCommand({ type: 'playMonopoly', resource: 'forest' })).toEqual({ type: 'playMonopoly', player: 0, resource: 'forest' });
    expect(parseCommand({ type: 'playYearOfPlenty', resources: ['hills', 'fields'] })).toEqual({ type: 'playYearOfPlenty', player: 0, resources: ['hills', 'fields'] });
    expect(parseCommand({ type: 'playYearOfPlenty', resources: ['hills'] })).toEqual({ type: 'playYearOfPlenty', player: 0, resources: ['hills'] }); // con el banco casi vacío; el motor valida cuántos
  });

  it('rechaza cartas mal formadas', () => {
    expect(parseCommand({ type: 'playMonopoly' })).toBeNull();
    expect(parseCommand({ type: 'playMonopoly', resource: 'oro' })).toBeNull();
    expect(parseCommand({ type: 'playYearOfPlenty', resources: [] })).toBeNull();
    expect(parseCommand({ type: 'playYearOfPlenty', resources: ['hills', 'oro'] })).toBeNull();
    expect(parseCommand({ type: 'playYearOfPlenty', resources: ['hills', 'fields', 'forest'] })).toBeNull();
    expect(parseCommand({ type: 'playYearOfPlenty', resources: 'hills' })).toBeNull();
  });

  it('acepta los comandos del comercio entre jugadores y rechaza los mal formados', () => {
    expect(parseCommand({ type: 'proposeTrade', give: { forest: 1 }, get: { hills: 2 } })).toEqual({ type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { hills: 2 } });
    expect(parseCommand({ type: 'proposeTrade', give: { forest: 1 }, get: { hills: 1 }, to: [2] })).toEqual({ type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { hills: 1 }, to: [2] });
    expect(parseCommand({ type: 'respondTrade', accept: true })).toEqual({ type: 'respondTrade', player: 0, accept: true });
    expect(parseCommand({ type: 'confirmTrade', with: 2 })).toEqual({ type: 'confirmTrade', player: 0, with: 2 });
    expect(parseCommand({ type: 'cancelTrade' })).toEqual({ type: 'cancelTrade', player: 0 });
    expect(parseCommand({ type: 'proposeTrade', give: { forest: 1 } })).toBeNull();
    expect(parseCommand({ type: 'proposeTrade', give: { oro: 1 }, get: { hills: 1 } })).toBeNull();
    expect(parseCommand({ type: 'proposeTrade', give: { forest: -1 }, get: { hills: 1 } })).toBeNull();
    expect(parseCommand({ type: 'proposeTrade', give: [1], get: { hills: 1 } })).toBeNull();
    expect(parseCommand({ type: 'proposeTrade', give: { forest: 1 }, get: { hills: 1 }, to: 'todos' })).toBeNull();
    expect(parseCommand({ type: 'respondTrade', accept: 'si' })).toBeNull();
    expect(parseCommand({ type: 'confirmTrade' })).toBeNull();
  });

  it('rechaza formas inválidas', () => {
    expect(parseCommand(null)).toBeNull();
    expect(parseCommand({ type: 'buildCity', vertex: 1.5 })).toBeNull();
    expect(parseCommand({ type: 'moveRobber' })).toBeNull();
    expect(parseCommand({ type: 'bankTrade', give: 'oro', get: 'forest' })).toBeNull();
    expect(parseCommand({ type: 'discard', cards: { forest: -1 } })).toBeNull();
    expect(parseCommand({ type: 'discard', cards: { oro: 1 } })).toBeNull();
    expect(parseCommand({ type: 'discard' })).toBeNull();
  });
});
