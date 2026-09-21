import { describe, expect, it } from 'vitest';
import { randomBot } from '../bots/random';
import { applyCommand, createGame, legalActions, mulberry32, victoryPoints } from '../engine';
import type { Command, GameState } from '../engine';
import { expectConserved, NAMES } from '../engine/testutil';
import { LocalSession } from './session';

const SEED = 8;

/** Aplica al motor (sin sesión) los mismos comandos que la partida guionada, para comparar los estados. */
async function scripted(session: LocalSession): Promise<{ direct: GameState; sent: number }> {
  let direct = createGame(NAMES, SEED);
  let sent = 0;
  for (let i = 0; i < 60; i++) {
    const view = session.view();
    if (view.game!.phase.kind === 'finished') break;
    const a = view.legal[0];
    const p = view.me;
    const cmd: Command =
      a.type === 'placeSettlement' ? { type: a.type, player: p, vertex: a.vertices[0] }
      : a.type === 'placeRoad' ? { type: a.type, player: p, edge: a.edges[a.edges.length - 1] }
      : a.type === 'buildRoad' ? { type: a.type, player: p, edge: a.edges[0] }
      : a.type === 'buildSettlement' ? { type: a.type, player: p, vertex: a.vertices[0] }
      : a.type === 'buildCity' ? { type: a.type, player: p, vertex: a.vertices[0] }
      : a.type === 'moveRobber' ? { type: a.type, player: p, tile: a.tiles[0] }
      : a.type === 'steal' ? { type: a.type, player: p, victim: a.victims[0] }
      : a.type === 'discard' ? { type: 'discard', player: p, cards: firstCards(session.debugState(), p, a.count) }
      : { type: a.type === 'rollDice' ? 'rollDice' : 'endTurn', player: p };
    const r = await session.send(cmd);
    const d = applyCommand(direct, cmd);
    expect(r.ok).toBe(d.ok);
    if (d.ok) direct = d.state;
    sent++;
  }
  return { direct, sent };
}

function firstCards(s: GameState, p: number, count: number) {
  const cards: Record<string, number> = {};
  let left = count;
  for (const [r, n] of Object.entries(s.players[p].hand)) {
    const take = Math.min(n, left);
    if (take) cards[r] = take;
    left -= take;
  }
  return cards;
}

describe('LocalSession', () => {
  it('una partida guionada llega al mismo estado que aplicar los comandos directo al motor', async () => {
    const session = new LocalSession(NAMES, SEED);
    const { direct, sent } = await scripted(session);
    expect(sent).toBeGreaterThan(30); // pasó por colocación, dados y turnos
    expect(session.debugState()).toEqual(direct);
  });

  it('la vista es la de quien tiene el turno: mano propia real, ajenas como cantidad, acciones legales del motor', async () => {
    const session = new LocalSession(NAMES, SEED);
    let v = session.view();
    expect(v.me).toBe(0);
    expect(v.legal).toEqual(legalActions(session.debugState(), 0));
    while (session.view().game!.phase.kind === 'setup') {
      const view = session.view();
      const a = view.legal[0];
      await session.send(a.type === 'placeSettlement' ? { type: a.type, player: view.me, vertex: a.vertices[0] } : { type: 'placeRoad', player: view.me, edge: (a as { edges: number[] }).edges[0] });
    }
    v = session.view();
    const s = session.debugState();
    expect(v.game!.players.map((p) => p.points)).toEqual(NAMES.map((_, p) => victoryPoints(s, p)));
    expect(v.game!.players.map((p) => p.handCount)).toEqual(s.players.map((p) => Object.values(p.hand).reduce((a, b) => a + b, 0)));
    expect(v.game!.hand).toEqual(s.players[v.me].hand);
    expect(JSON.stringify(v)).not.toContain('seed');
  });

  it('un comando ilegal devuelve el error del motor y no cambia la versión', async () => {
    const session = new LocalSession(NAMES, SEED);
    const before = session.view().version;
    const r = await session.send({ type: 'rollDice', player: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: 'wrong-phase' } });
    expect(session.view().version).toBe(before);
  });

  it('avisa a los suscriptores con la vista nueva y los eventos, y se puede dar de baja', async () => {
    const session = new LocalSession(NAMES, SEED);
    const seen: string[][] = [];
    const off = session.subscribe((view, events) => seen.push(events.map((e) => e.type)));
    const v = session.view();
    await session.send({ type: 'placeSettlement', player: 0, vertex: (v.legal[0] as { vertices: number[] }).vertices[0] });
    off();
    await session.send({ type: 'placeRoad', player: 0, edge: (session.view().legal[0] as { edges: number[] }).edges[0] });
    expect(seen).toEqual([['SettlementBuilt']]);
  });

  it('autoSetup completa la colocación inicial con jugadas legales', () => {
    const session = new LocalSession(NAMES, SEED);
    session.autoSetup((options) => options[0]);
    expect(session.view().game!.phase.kind).toBe('roll');
    expect(session.debugState().vertexBuildings.filter(Boolean)).toHaveLength(8);
  });

  it('debugMutate trabaja sobre una copia', () => {
    const session = new LocalSession(NAMES, SEED);
    const old = session.debugState();
    session.debugMutate((s) => { s.robber = 5; });
    expect(session.debugState().robber).toBe(5);
    expect(old.robber).not.toBe(5);
  });
});

describe('LocalSession contra bots', () => {
  const BOTS = [false, true, true, true];
  const setupCmd = (session: LocalSession): Command => {
    const v = session.view();
    const a = v.legal[0];
    return a.type === 'placeSettlement' ? { type: a.type, player: v.me, vertex: a.vertices[0] } : { type: 'placeRoad', player: v.me, edge: (a as { edges: number[] }).edges[0] };
  };

  it('el humano es siempre el asiento 0 y los bots se marcan como tales', () => {
    const session = new LocalSession(NAMES, SEED, undefined, { bots: BOTS, rng: mulberry32(1) });
    expect(session.view().me).toBe(0);
    expect(session.view().seats.map((s) => s.bot)).toEqual(BOTS);
    expect(() => new LocalSession(NAMES, SEED, undefined, { bots: [true, false, false, false] })).toThrow();
  });

  it('tras el comando del humano juegan los bots (la colocación va en serpentina) y sus eventos siguen a los del humano', async () => {
    const session = new LocalSession(NAMES, SEED, undefined, { bots: BOTS, rng: mulberry32(1) });
    await session.send(setupCmd(session)); // poblado del humano
    const r = await session.send(setupCmd(session)); // camino del humano → juegan los bots 1, 2, 3, 3, 2, 1
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const built = r.events.filter((e) => e.type === 'SettlementBuilt').map((e) => (e as { player: number }).player);
    expect(built).toEqual([1, 2, 3, 3, 2, 1]);
    expect(r.events[0]).toMatchObject({ type: 'RoadBuilt', player: 0 }); // primero lo del humano
    expect(session.view().game!.turn).toBe(0); // vuelve al humano para su segundo poblado
  });

  it('los bots se frenan cuando vuelve a tocarle al humano y el humano siempre tiene acciones legales', async () => {
    const session = new LocalSession(NAMES, SEED, undefined, { bots: BOTS, rng: mulberry32(2) });
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const v = session.view();
      if (v.game!.phase.kind === 'finished') break;
      expect(v.game!.turn).toBe(0);
      expect(v.legal.length).toBeGreaterThan(0);
      const r = await session.send(randomBot({ me: 0, legal: v.legal, hand: v.game!.hand }, rng));
      expect(r.ok).toBe(true);
      expectConserved(session.debugState());
    }
    expect(session.debugState().vertexBuildings.filter(Boolean).length).toBeGreaterThan(8); // pasó la colocación y construyeron
  });

  it('la vista no revela lo que hicieron los bots a escondidas: el robo entre bots llega sin recurso', async () => {
    const session = new LocalSession(NAMES, SEED, undefined, { bots: BOTS, rng: mulberry32(4) });
    const rng = mulberry32(5);
    const stolen: (string | null)[] = [];
    for (let i = 0; i < 400 && session.view().game!.phase.kind !== 'finished'; i++) {
      const v = session.view();
      const r = await session.send(randomBot({ me: 0, legal: v.legal, hand: v.game!.hand }, rng));
      if (r.ok) for (const e of r.events) if (e.type === 'Stolen' && e.thief !== 0 && e.victim !== 0) stolen.push(e.resource);
    }
    expect(stolen.length).toBeGreaterThan(0);
    expect(stolen.every((x) => x === null)).toBe(true);
  }, 60000);
});

describe('kick: apertura de un bot', () => {
  it('si abre un bot no juega solo al crear la sesión; kick() lo hace jugar hasta que le toca al humano', async () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((s) => createGame(['Ana', 'B1', 'B2'], s, { firstPlayer: null }).first !== 0)!;
    const session = new LocalSession(['Ana', 'B1', 'B2'], seed, { firstPlayer: null }, { bots: [false, true, true] });
    const before = session.view().game!;
    expect(before.vertexBuildings.every((b) => b === null)).toBe(true);
    expect(before.turn).not.toBe(0);
    const events = await session.kick();
    expect(events.length).toBeGreaterThan(0);
    expect(session.view().game!.turn).toBe(0);
    expect(await session.kick()).toEqual([]); // ya le toca al humano
  });

  it('si abre el humano, kick() no hace nada', async () => {
    const session = new LocalSession(['Ana', 'B1', 'B2'], 1, undefined, { bots: [false, true, true] });
    expect(await session.kick()).toEqual([]);
  });
});
