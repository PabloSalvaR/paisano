import { describe, expect, it } from 'vitest';
import type { Command } from '../engine';
import { MemoryStore } from './store';
import { createRoom, getView, hashToken, joinRoom, startGame, submitCommand, type Res } from './rooms';
import { createGame } from '../engine';
import { gameView, viewEvent } from './view';

const newStore = () => new MemoryStore(new Map());

function val<T>(r: Res<T>): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
}
const code = <T>(r: Res<T>): string => (r.ok ? 'ok' : r.error.code);

/** Sala con `n` jugadores humanos (Ana es la anfitriona). */
async function lobby(store: MemoryStore, n = 3) {
  const names = ['Ana', 'Beto', 'Cata', 'Dani'].slice(0, n);
  const host = val(await createRoom(store, names[0]));
  const tokens = [host.token];
  for (const name of names.slice(1)) tokens.push(val(await joinRoom(store, host.roomId, name)).token);
  return { roomId: host.roomId, tokens };
}

async function started(n = 3, seed = 8) {
  const store = newStore();
  const { roomId, tokens } = await lobby(store, n);
  val(await startGame(store, roomId, tokens[0], { seed }));
  return { store, roomId, tokens };
}

/** Comando legal de colocación para quien tiene el turno, según la vista del servidor. */
const firstSettlement = (legal: { type: string; vertices?: number[] }[]): Command => {
  const a = legal.find((x) => x.type === 'placeSettlement')!;
  return { type: 'placeSettlement', player: 0, vertex: a.vertices![0] };
};

describe('lobby', () => {
  it('crea una sala y no guarda el token en claro', async () => {
    const store = newStore();
    const { roomId, token } = val(await createRoom(store, ' Ana '));
    const stored = await store.get(roomId);
    expect(stored!.seats[0]).toEqual({ name: 'Ana', tokenHash: hashToken(token), bot: false });
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('rechaza nombres vacíos, largos o repetidos', async () => {
    const store = newStore();
    expect(code(await createRoom(store, '   '))).toBe('invalid-name');
    expect(code(await createRoom(store, 'x'.repeat(21)))).toBe('invalid-name');
    const { roomId } = val(await createRoom(store, 'Ana'));
    expect(code(await joinRoom(store, roomId, 'ana'))).toBe('name-taken');
  });

  it('la sala tiene un máximo de 4 y no existe si el código es otro', async () => {
    const store = newStore();
    const { roomId } = await lobby(store, 4);
    expect(code(await joinRoom(store, roomId, 'Eva'))).toBe('room-full');
    expect(code(await joinRoom(store, 'ZZZZZZ', 'Eva'))).toBe('room-not-found');
  });

  it('solo el anfitrión empieza, con al menos 3 jugadores', async () => {
    const store = newStore();
    const { roomId, tokens } = await lobby(store, 2);
    expect(code(await startGame(store, roomId, tokens[0]))).toBe('not-enough-players');
    const c = val(await joinRoom(store, roomId, 'Cata'));
    expect(code(await startGame(store, roomId, c.token))).toBe('not-host');
    expect(code(await startGame(store, roomId, 'token-ajeno'))).toBe('not-in-room');
    const view = val(await startGame(store, roomId, tokens[0], { seed: 8 }));
    expect(view.status).toBe('playing');
    expect(view.game!.players.map((p) => p.name)).toEqual(['Ana', 'Beto', 'Cata']);
    expect(code(await startGame(store, roomId, tokens[0]))).toBe('already-started');
    expect(code(await joinRoom(store, roomId, 'Dani'))).toBe('already-started');
  });
});

describe('comandos', () => {
  it('juega un comando legal: sube la versión y devuelve sus eventos', async () => {
    const { store, roomId, tokens } = await started();
    const before = val(await getView(store, roomId, tokens[0]));
    const after = val(await submitCommand(store, roomId, tokens[0], firstSettlement(before.legal)));
    expect(after.version).toBe(before.version + 1);
    expect(after.events.map((e) => e.event.type)).toEqual(['SettlementBuilt']);
    expect(after.events[0].version).toBe(after.version);
  });

  it('el jugador sale del token: no se puede actuar por otro', async () => {
    const { store, roomId, tokens } = await started();
    const view = val(await getView(store, roomId, tokens[0]));
    // Beto manda un comando diciendo que es el jugador 0, pero le toca a Ana
    expect(code(await submitCommand(store, roomId, tokens[1], firstSettlement(view.legal)))).toBe('not-your-turn');
    expect(code(await submitCommand(store, roomId, 'token-ajeno', firstSettlement(view.legal)))).toBe('not-in-room');
  });

  it('un comando ilegal devuelve el error del motor y no cambia la sala', async () => {
    const { store, roomId, tokens } = await started();
    const v0 = val(await getView(store, roomId, tokens[0]));
    expect(code(await submitCommand(store, roomId, tokens[0], { type: 'rollDice', player: 0 }))).toBe('wrong-phase');
    expect(val(await getView(store, roomId, tokens[0])).version).toBe(v0.version);
  });

  it('no se juega antes de empezar', async () => {
    const store = newStore();
    const { roomId, tokens } = await lobby(store);
    expect(code(await submitCommand(store, roomId, tokens[0], { type: 'rollDice', player: 0 }))).toBe('not-started');
  });

  it('dos comandos a la vez: el segundo se revalida contra el estado nuevo', async () => {
    const { store, roomId, tokens } = await started();
    const view = val(await getView(store, roomId, tokens[0]));
    const cmd = firstSettlement(view.legal);
    const [a, b] = await Promise.all([submitCommand(store, roomId, tokens[0], cmd), submitCommand(store, roomId, tokens[0], cmd)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1); // el mismo poblado no se puede colocar dos veces
    expect(val(await getView(store, roomId, tokens[0])).events).toHaveLength(1);
  });
});

describe('vista filtrada', () => {
  it('no incluye semillas ni manos ajenas, y las acciones legales son solo de quien mira', async () => {
    const { store, roomId, tokens } = await started();
    const mine = val(await getView(store, roomId, tokens[0]));
    const theirs = val(await getView(store, roomId, tokens[1]));
    const json = JSON.stringify(mine);
    expect(json).not.toContain('seed');
    expect(json).not.toContain('"dice"');
    expect(mine.game!.players.every((p) => !('hand' in p))).toBe(true);
    expect(mine.me).toBe(0);
    expect(mine.legal.length).toBeGreaterThan(0); // le toca a Ana
    expect(theirs.me).toBe(1);
    expect(theirs.legal).toEqual([]); // Beto espera
  });

  it('la mano propia es real y las ajenas son cantidades', async () => {
    const { store, roomId, tokens } = await started();
    const room = (await store.get(roomId))!;
    room.state!.players[1].hand.forest = 2;
    room.state!.players[1].hand.hills = 1;
    room.state!.bank.forest -= 2;
    room.state!.bank.hills -= 1;
    expect(await store.save(room, room.version)).toBe(true);
    const beto = val(await getView(store, roomId, tokens[1]));
    const ana = val(await getView(store, roomId, tokens[0]));
    expect(beto.game!.hand).toMatchObject({ forest: 2, hills: 1 });
    expect(ana.game!.hand).toMatchObject({ forest: 0, hills: 0 });
    expect(ana.game!.players[1].handCount).toBe(3);
  });

  it('`since` limita los eventos', async () => {
    const { store, roomId, tokens } = await started();
    const v0 = val(await getView(store, roomId, tokens[0]));
    const v1 = val(await submitCommand(store, roomId, tokens[0], firstSettlement(v0.legal)));
    expect(val(await getView(store, roomId, tokens[1], v0.version)).events).toHaveLength(1);
    expect(val(await getView(store, roomId, tokens[1], v1.version)).events).toHaveLength(0);
  });

  it('cartas de desarrollo: el mazo no sale, las ajenas son cantidades y la Estancia ajena no suma a sus puntos', async () => {
    const { store, roomId, tokens } = await started();
    const room = (await store.get(roomId))!;
    room.state!.players[1].dev.victoryPoint = 2;
    room.state!.players[1].dev.knight = 1;
    room.state!.devDeck = room.state!.devDeck.filter((_, i) => i > 2);
    expect(await store.save(room, room.version)).toBe(true);
    const ana = val(await getView(store, roomId, tokens[0]));
    const beto = val(await getView(store, roomId, tokens[1]));
    expect(ana.game).not.toHaveProperty('devDeck'); // (`config.devDeck` es solo la composición del mazo, no su orden)
    expect(JSON.stringify(ana)).not.toContain(JSON.stringify(room.state!.devDeck));
    expect(ana.game!.deckCount).toBe(room.state!.devDeck.length);
    expect(ana.game!.players[1]).toMatchObject({ devCount: 3, knights: 0 });
    expect(ana.game!.dev.hand).toMatchObject({ knight: 0, victoryPoint: 0 });
    expect(beto.game!.dev.hand).toMatchObject({ knight: 1, victoryPoint: 2 });
    expect(beto.game!.players[1].points).toBe(ana.game!.players[1].points + 2); // él sí cuenta sus Estancias
  });

  it('qué carta compró un jugador solo lo ve él', () => {
    const bought = { type: 'DevCardBought', player: 1, kind: 'knight' } as const;
    expect(viewEvent(bought, 1)).toEqual(bought);
    expect(viewEvent(bought, 0)).toEqual({ ...bought, kind: null });
  });

  it('el recurso robado solo lo ven el ladrón y la víctima', () => {
    const stolen = { type: 'Stolen', thief: 0, victim: 1, resource: 'forest' } as const;
    expect(viewEvent(stolen, 0)).toEqual(stolen);
    expect(viewEvent(stolen, 1)).toEqual(stolen);
    expect(viewEvent(stolen, 2)).toEqual({ ...stolen, resource: null });
  });
});

describe('vista: contadores públicos de cada jugador', () => {
  it('trae los gauchos jugados y el largo de ruta de todos (públicos), para verlos siempre en los puestos', () => {
    const s = createGame(['A', 'B', 'C'], 5);
    s.players[1].knightsPlayed = 2;
    const v = gameView(s, 0);
    expect(v.players.map((p) => p.knights)).toEqual([0, 2, 0]);
    expect(v.players.map((p) => p.roadLength)).toEqual([0, 0, 0]);
  });

  it('trae cuántas ofertas de comercio se abrieron en el turno (pública), para grisar «Ofrecer» al llegar al tope', () => {
    const s = createGame(['A', 'B', 'C'], 5);
    expect(gameView(s, 1).tradeOffers).toBe(0);
    s.tradeOffers = 5;
    expect(gameView(s, 1).tradeOffers).toBe(5);
  });
});
