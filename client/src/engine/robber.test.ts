import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { rollDiceFor } from './dice';
import { applyCommand, createGame, legalActions } from './game';
import { handTotal } from './helpers';
import { RESOURCES } from './map';
import { robberVictims } from './robber';
import { clearHands, errorOf, expectConserved, mainPhaseGame, must, NAMES, playSetup, setHand } from './testutil';
import type { GameState } from './types';

const topo = topology();

/** Partida en fase "roll" (jugador 0) con los dados forzados a dar 7. */
function aboutToRollSeven(): GameState {
  const s = playSetup(createGame(NAMES, 8));
  clearHands(s);
  let k = 0;
  while (rollDiceFor(s.dice.seed, k).reduce((a, b) => a + b, 0) !== 7) k++;
  s.dice.rolls = k;
  return s;
}

/** Deja al ladrón fuera del desierto y pone poblados de los jugadores 1 y 2 en dos esquinas de la casilla `tile`. */
function robberScene(): { s: GameState; tile: number } {
  const s = mainPhaseGame();
  s.phase = { kind: 'moveRobber' };
  s.vertexBuildings = s.vertexBuildings.map(() => null);
  const tile = topo.tiles.find((t) => t.id !== s.robber && s.map.terrains[t.id] !== 'desert')!.id;
  const t = topo.tiles[tile];
  s.vertexBuildings[t.vertices[0]] = { player: 1, city: false };
  s.vertexBuildings[t.vertices[2]] = { player: 2, city: false };
  return { s, tile };
}

describe('el 7: descarte', () => {
  it('descartan (la mitad, redondeando hacia abajo) solo quienes tienen MÁS de 7 cartas, en orden de mesa desde quien tiró', () => {
    const s = aboutToRollSeven();
    setHand(s, 1, { forest: 5, hills: 4 }); // 9 → descarta 4
    setHand(s, 2, { pasture: 8 }); // 8 → descarta 4
    setHand(s, 3, { fields: 7 }); // 7 → no descarta
    setHand(s, 0, { mountains: 20 }); // el que tira también descarta si tiene de más (20 → 10)
    const r = must(s, { type: 'rollDice', player: 0 });
    expect(r.state.phase).toEqual({
      kind: 'discard',
      roller: 0,
      queue: [{ player: 0, count: 10 }, { player: 1, count: 4 }, { player: 2, count: 4 }],
    });
    expect(r.state.turn).toBe(0);
    expect(r.events.map((e) => e.type)).toEqual(['DiceRolled', 'DiscardRequired']);
    expect(legalActions(r.state, 0)).toEqual([{ type: 'discard', count: 10 }]);
    expect(legalActions(r.state, 1)).toEqual([]); // todavía no es su turno de descartar
  });

  it('rechaza descartes con la cantidad equivocada, cartas que no tiene o números inválidos', () => {
    const s = aboutToRollSeven();
    setHand(s, 1, { forest: 5, hills: 4 });
    let g = must(s, { type: 'rollDice', player: 0 }).state;
    expect(g.turn).toBe(1);
    expect(errorOf(applyCommand(g, { type: 'discard', player: 1, cards: { forest: 3 } }))).toBe('invalid-discard');
    expect(errorOf(applyCommand(g, { type: 'discard', player: 1, cards: { forest: 5 } }))).toBe('invalid-discard');
    expect(errorOf(applyCommand(g, { type: 'discard', player: 1, cards: { pasture: 4 } }))).toBe('invalid-discard');
    expect(errorOf(applyCommand(g, { type: 'discard', player: 1, cards: { forest: 5, hills: -1 } }))).toBe('invalid-discard');
    expect(errorOf(applyCommand(g, { type: 'discard', player: 1, cards: { forest: 1.5, hills: 2.5 } }))).toBe('invalid-discard');
    expect(errorOf(applyCommand(g, { type: 'discard', player: 0, cards: {} }))).toBe('not-your-turn');
    g = must(g, { type: 'discard', player: 1, cards: { forest: 2, hills: 2 } }).state;
    expect(g.players[1].hand).toEqual({ forest: 3, hills: 2, pasture: 0, fields: 0, mountains: 0 });
  });

  it('las cartas descartadas vuelven al banco y, al terminar, el que tiró mueve al ladrón', () => {
    const s = aboutToRollSeven();
    setHand(s, 1, { forest: 5, hills: 4 });
    setHand(s, 2, { pasture: 8 });
    const bankBefore = RESOURCES.reduce((n, r) => n + s.bank[r], 0);
    let g = must(s, { type: 'rollDice', player: 0 }).state;
    g = must(g, { type: 'discard', player: 1, cards: { forest: 4 } }).state;
    expect(g.turn).toBe(2);
    expect(g.phase.kind).toBe('discard');
    g = must(g, { type: 'discard', player: 2, cards: { pasture: 4 } }).state;
    expect(RESOURCES.reduce((n, r) => n + g.bank[r], 0)).toBe(bankBefore + 8);
    expect(g.phase).toEqual({ kind: 'moveRobber' });
    expect(g.turn).toBe(0);
    expectConserved(g);
  });

  it('con exactamente 7 cartas no hay descarte', () => {
    const s = aboutToRollSeven();
    setHand(s, 1, { forest: 7 });
    expect(must(s, { type: 'rollDice', player: 0 }).state.phase).toEqual({ kind: 'moveRobber' });
  });
});

describe('el 7: mover al ladrón y robar', () => {
  it('no puede quedarse en la misma casilla ni ir a una inexistente', () => {
    const { s } = robberScene();
    expect(errorOf(applyCommand(s, { type: 'moveRobber', player: 0, tile: s.robber }))).toBe('same-tile');
    expect(errorOf(applyCommand(s, { type: 'moveRobber', player: 0, tile: 99 }))).toBe('invalid-tile');
    expect(errorOf(applyCommand(s, { type: 'moveRobber', player: 0, tile: -1 }))).toBe('invalid-tile');
    expect(errorOf(applyCommand(s, { type: 'endTurn', player: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand(s, { type: 'steal', player: 0, victim: 1 }))).toBe('wrong-phase');
    const acts = legalActions(s, 0)[0];
    expect(acts.type === 'moveRobber' && acts.tiles).toHaveLength(18);
  });

  it('sin rivales junto a la casilla no se roba nada y sigue el turno', () => {
    const { s } = robberScene();
    const empty = topo.tiles.find((t) => t.id !== s.robber && t.vertices.every((v) => s.vertexBuildings[v] === null))!.id;
    const r = must(s, { type: 'moveRobber', player: 0, tile: empty });
    expect(r.state.robber).toBe(empty);
    expect(r.state.phase).toEqual({ kind: 'main' });
    expect(r.events.map((e) => e.type)).toEqual(['RobberMoved']);
  });

  it('con un solo rival con cartas se le roba una al azar en el acto; los rivales sin cartas no cuentan', () => {
    const { s, tile } = robberScene();
    setHand(s, 1, { forest: 2, hills: 1 });
    setHand(s, 2, {}); // sin cartas: no es víctima
    expect(robberVictims(s, 0, tile)).toEqual([1]);
    const r = must(s, { type: 'moveRobber', player: 0, tile });
    expect(r.state.phase).toEqual({ kind: 'main' });
    expect(handTotal(r.state.players[0].hand)).toBe(1);
    expect(handTotal(r.state.players[1].hand)).toBe(2);
    const ev = r.events.find((e) => e.type === 'Stolen')!;
    expect(ev).toMatchObject({ type: 'Stolen', thief: 0, victim: 1 });
    expectConserved(r.state);
  });

  it('con varios candidatos hay que elegir a quién; solo vale un candidato válido', () => {
    const { s, tile } = robberScene();
    setHand(s, 1, { forest: 1 });
    setHand(s, 2, { hills: 1 });
    let g = must(s, { type: 'moveRobber', player: 0, tile }).state;
    expect(g.phase).toEqual({ kind: 'steal', victims: [1, 2] });
    expect(legalActions(g, 0)).toEqual([{ type: 'steal', victims: [1, 2] }]);
    expect(errorOf(applyCommand(g, { type: 'steal', player: 0, victim: 3 }))).toBe('invalid-victim');
    expect(errorOf(applyCommand(g, { type: 'steal', player: 0, victim: 0 }))).toBe('invalid-victim');
    expect(errorOf(applyCommand(g, { type: 'moveRobber', player: 0, tile: 0 }))).toBe('wrong-phase');
    g = must(g, { type: 'steal', player: 0, victim: 2 }).state;
    expect(g.players[0].hand.hills).toBe(1);
    expect(g.players[2].hand.hills).toBe(0);
    expect(g.phase).toEqual({ kind: 'main' });
  });

  it('el robo es determinista (mismo estado = mismo robo) y cada carta tiene la misma chance', () => {
    const { s, tile } = robberScene();
    setHand(s, 1, { forest: 1, hills: 3 });
    setHand(s, 2, {});
    const stolen = (count: number) => {
      const c = structuredClone(s);
      c.random.count = count;
      const r = must(c, { type: 'moveRobber', player: 0, tile });
      return r.events.find((e) => e.type === 'Stolen');
    };
    expect(stolen(5)).toEqual(stolen(5));
    let hills = 0;
    for (let i = 0; i < 400; i++) if (stolen(i)?.type === 'Stolen' && (stolen(i) as { resource: string }).resource === 'hills') hills++;
    expect(hills / 400).toBeGreaterThan(0.65); // 3 de 4 cartas
    expect(hills / 400).toBeLessThan(0.85);
  });

  it('el ladrón bloquea la producción de su casilla y, al irse, la libera', () => {
    const s = mainPhaseGame();
    s.vertexBuildings = s.vertexBuildings.map(() => null);
    const tile = topo.tiles.find((t) => s.map.terrains[t.id] === 'forest')!.id;
    s.map.numbers = s.map.numbers.map((n, id) => (id === tile ? 6 : n === 6 ? 5 : n)); // solo esta casilla lleva 6
    s.vertexBuildings[topo.tiles[tile].vertices[0]] = { player: 1, city: false };
    s.phase = { kind: 'roll' };
    let k = 0;
    while (rollDiceFor(s.dice.seed, k).reduce((a, b) => a + b, 0) !== 6) k++;
    s.dice.rolls = k;
    const otherTile = topo.tiles.find((t) => t.id !== tile)!.id;

    const blocked = structuredClone(s);
    blocked.robber = tile;
    expect(must(blocked, { type: 'rollDice', player: 0 }).state.players[1].hand.forest).toBe(0);

    const free = structuredClone(s);
    free.robber = otherTile;
    expect(must(free, { type: 'rollDice', player: 0 }).state.players[1].hand.forest).toBe(1);
  });
});

describe('el 7 de punta a punta', () => {
  it('tirada → descartes → ladrón → robo → turno normal, con los recursos siempre conservados', () => {
    const s = aboutToRollSeven();
    // se arma el tablero para que la casilla elegida tenga al jugador 1 pegado
    setHand(s, 0, { forest: 1 });
    setHand(s, 1, { forest: 5, hills: 5 });
    let g = must(s, { type: 'rollDice', player: 0 }).state;
    expect(g.phase.kind).toBe('discard');
    g = must(g, { type: 'discard', player: 1, cards: { forest: 3, hills: 2 } }).state;
    expect(g.phase).toEqual({ kind: 'moveRobber' });
    const victimTile = topo.tiles.find((t) => t.id !== g.robber && robberVictims(g, 0, t.id).includes(1));
    const target = victimTile ? victimTile.id : topo.tiles.find((t) => t.id !== g.robber)!.id;
    g = must(g, { type: 'moveRobber', player: 0, tile: target }).state;
    expect(['main', 'steal']).toContain(g.phase.kind);
    if (g.phase.kind === 'steal') g = must(g, { type: 'steal', player: 0, victim: g.phase.victims[0] }).state;
    expect(g.phase).toEqual({ kind: 'main' });
    expect(g.turn).toBe(0);
    expectConserved(g);
  });
});
