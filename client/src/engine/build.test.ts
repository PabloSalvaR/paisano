import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { buildCity, buildRoad, buildSettlement, cityOptions, roadOptions, settlementOptions } from './build';
import { applyCommand, createGame, legalActions } from './game';
import { pieceCounts, victoryPoints } from './helpers';
import { mainPhaseGame, must, errorOf, NAMES, playSetup, RICH, setHand, expectConserved } from './testutil';
import type { GameState } from './types';

const topo = topology();
const settlementsOf = (s: GameState, p: number) => s.vertexBuildings.flatMap((b, v) => (b?.player === p && !b.city ? [v] : []));

/** Tablero vacío en fase "main" para armar caminos y poblados a mano. */
function emptyBoard(): GameState {
  const s = mainPhaseGame();
  s.vertexBuildings = s.vertexBuildings.map(() => null);
  s.edgeRoads = s.edgeRoads.map(() => null);
  return s;
}

/** Recorre el tablero desde el vértice `start` siguiendo vecinos que no se repiten: v0, v1, v2, ... */
function path(start: number, length: number): number[] {
  const out = [start];
  while (out.length < length) {
    const next = topo.vertices[out[out.length - 1]].neighbors.find((n) => !out.includes(n));
    if (next === undefined) break;
    out.push(next);
  }
  return out;
}
const edgeId = (a: number, b: number) => topo.edgeBetween(a, b)!.id;

describe('construir: caminos', () => {
  it('cuesta 1 madera + 1 ladrillo (van al banco) y aparece el camino', () => {
    const s = mainPhaseGame();
    setHand(s, 0, RICH);
    const edge = roadOptions(s, 0)[0];
    const r = must(s, { type: 'buildRoad', player: 0, edge });
    expect(r.state.edgeRoads[edge]).toBe(0);
    expect(r.state.players[0].hand).toEqual({ ...RICH, forest: 4, hills: 4 });
    expect(r.state.bank.forest).toBe(s.bank.forest + 1);
    expect(r.events.map((e) => e.type)).toEqual(['ResourcesSpent', 'RoadBuilt']);
    expectConserved(r.state);
  });

  it('todas las opciones salen de la red propia (poblado o camino propio)', () => {
    const s = mainPhaseGame();
    setHand(s, 0, RICH);
    for (const edge of roadOptions(s, 0)) {
      const e = topo.edges[edge];
      const touches = [e.a, e.b].some(
        (v) => s.vertexBuildings[v]?.player === 0 || topo.vertices[v].edges.some((id) => id !== edge && s.edgeRoads[id] === 0),
      );
      expect(touches).toBe(true);
    }
  });

  it('rechaza un camino desconectado, ocupado, inexistente o sin recursos', () => {
    const s = mainPhaseGame();
    setHand(s, 0, RICH);
    const far = topo.edges.find((e) => !roadOptions(s, 0).includes(e.id) && s.edgeRoads[e.id] === null)!.id;
    expect(errorOf(applyCommand(s, { type: 'buildRoad', player: 0, edge: far }))).toBe('not-connected');
    expect(errorOf(applyCommand(s, { type: 'buildRoad', player: 0, edge: s.edgeRoads.findIndex((p) => p === 0) }))).toBe('occupied');
    expect(errorOf(applyCommand(s, { type: 'buildRoad', player: 0, edge: 999 }))).toBe('invalid-edge');
    const poor = mainPhaseGame();
    setHand(poor, 0, { forest: 1 });
    const edge = topo.vertices[settlementsOf(poor, 0)[0]].edges.find((e) => poor.edgeRoads[e] === null)!;
    expect(errorOf(applyCommand(poor, { type: 'buildRoad', player: 0, edge }))).toBe('insufficient-resources');
  });

  it('un poblado rival en el extremo corta el camino: no se puede seguir de largo', () => {
    const s = emptyBoard();
    setHand(s, 0, RICH);
    const [v0, v1, v2] = path(0, 3);
    s.edgeRoads[edgeId(v0, v1)] = 0;
    s.vertexBuildings[v1] = { player: 1, city: false };
    expect(errorOf(applyCommand(s, { type: 'buildRoad', player: 0, edge: edgeId(v1, v2) }))).toBe('not-connected');
    // por el otro extremo (v0, libre) sí se puede seguir
    const other = topo.vertices[v0].edges.find((e) => e !== edgeId(v0, v1))!;
    expect(applyCommand(s, { type: 'buildRoad', player: 0, edge: other }).ok).toBe(true);
    // y si el poblado del extremo es propio, también se sigue
    s.vertexBuildings[v1] = { player: 0, city: false };
    expect(applyCommand(s, { type: 'buildRoad', player: 0, edge: edgeId(v1, v2) }).ok).toBe(true);
  });

  it('respeta el máximo de caminos', () => {
    const s = playSetup(createGame(NAMES, 8, { maxPieces: { roads: 2, settlements: 5, cities: 4 } }));
    s.phase = { kind: 'main' };
    s.turn = 0;
    setHand(s, 0, RICH);
    expect(pieceCounts(s, 0).roads).toBe(2);
    expect(roadOptions(s, 0)).toEqual([]);
    const edge = topo.vertices[settlementsOf(s, 0)[0]].edges.find((e) => s.edgeRoads[e] === null)!;
    expect(errorOf(applyCommand(s, { type: 'buildRoad', player: 0, edge }))).toBe('no-pieces-left');
  });

  it('solo se construye en la fase "main" (después de tirar los dados)', () => {
    const s = mainPhaseGame();
    setHand(s, 0, RICH);
    s.phase = { kind: 'roll' };
    expect(errorOf(applyCommand(s, { type: 'buildRoad', player: 0, edge: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand(s, { type: 'buildCity', player: 0, vertex: 0 }))).toBe('wrong-phase');
  });
});

describe('construir: poblados', () => {
  /** Camino propio de dos tramos v0-v1-v2 sin ninguna otra pieza: v2 es el único lugar posible para un poblado nuevo. */
  function corridor() {
    const s = emptyBoard();
    setHand(s, 0, RICH);
    const [v0, v1, v2] = path(0, 3);
    s.vertexBuildings[v0] = { player: 0, city: false };
    s.edgeRoads[edgeId(v0, v1)] = 0;
    s.edgeRoads[edgeId(v1, v2)] = 0;
    return { s, v0, v1, v2 };
  }

  it('cuesta madera + ladrillo + vaca + maíz y suma un punto', () => {
    const { s, v2 } = corridor();
    expect(settlementOptions(s, 0)).toContain(v2);
    const r = must(s, { type: 'buildSettlement', player: 0, vertex: v2 });
    expect(r.state.vertexBuildings[v2]).toEqual({ player: 0, city: false });
    expect(r.state.players[0].hand).toEqual({ forest: 4, hills: 4, pasture: 4, fields: 4, mountains: 5 });
    expect(victoryPoints(r.state, 0)).toBe(2);
    expectConserved(r.state);
  });

  it('exige un camino propio al lado, respeta la distancia y rechaza vértices ocupados o inexistentes', () => {
    const { s, v0, v1, v2 } = corridor();
    const unrelated = topo.vertices.find((v) => v.id !== v0 && v.id !== v1 && v.id !== v2 && !v.neighbors.some((n) => [v0, v1, v2].includes(n)))!.id;
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: unrelated }))).toBe('not-connected');
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: v1 }))).toBe('too-close'); // pegado a v0
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: v0 }))).toBe('occupied');
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: -3 }))).toBe('invalid-vertex');
    // un rival a un camino de distancia de v2 también impide construir ahí
    const nb = topo.vertices[v2].neighbors.find((n) => n !== v1)!;
    s.vertexBuildings[nb] = { player: 1, city: false };
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: v2 }))).toBe('too-close');
  });

  it('sin recursos o sin poblados en reserva, no se puede', () => {
    const { s, v2 } = corridor();
    setHand(s, 0, { forest: 1, hills: 1, pasture: 1 }); // falta maíz
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: v2 }))).toBe('insufficient-resources');
    setHand(s, 0, RICH);
    s.config.maxPieces.settlements = 1;
    expect(errorOf(applyCommand(s, { type: 'buildSettlement', player: 0, vertex: v2 }))).toBe('no-pieces-left');
  });
});

describe('construir: ciudades', () => {
  it('mejora un poblado propio: cuesta 2 maíz + 3 piedras, cuenta doble y libera el poblado', () => {
    const s = mainPhaseGame();
    setHand(s, 0, RICH);
    const v = settlementsOf(s, 0)[0];
    expect(cityOptions(s, 0)).toContain(v);
    const r = must(s, { type: 'buildCity', player: 0, vertex: v });
    expect(r.state.vertexBuildings[v]).toEqual({ player: 0, city: true });
    expect(r.state.players[0].hand).toEqual({ ...RICH, fields: 3, mountains: 2 });
    expect(victoryPoints(r.state, 0)).toBe(3);
    expect(pieceCounts(r.state, 0)).toEqual({ roads: 2, settlements: 1, cities: 1 });
    expectConserved(r.state);
  });

  it('no se puede sobre poblados ajenos, sobre una ciudad, en un vértice vacío ni sin recursos', () => {
    const s = mainPhaseGame();
    setHand(s, 0, RICH);
    const mine = settlementsOf(s, 0)[0];
    const theirs = settlementsOf(s, 1)[0];
    const empty = s.vertexBuildings.findIndex((b) => b === null);
    expect(errorOf(applyCommand(s, { type: 'buildCity', player: 0, vertex: theirs }))).toBe('invalid-target');
    expect(errorOf(applyCommand(s, { type: 'buildCity', player: 0, vertex: empty }))).toBe('invalid-target');
    s.vertexBuildings[mine] = { player: 0, city: true };
    expect(errorOf(applyCommand(s, { type: 'buildCity', player: 0, vertex: mine }))).toBe('invalid-target');
    const other = settlementsOf(s, 0)[0];
    setHand(s, 0, { fields: 2, mountains: 2 });
    expect(errorOf(applyCommand(s, { type: 'buildCity', player: 0, vertex: other }))).toBe('insufficient-resources');
  });

  it('respeta el máximo de ciudades', () => {
    const s = mainPhaseGame();
    s.config.maxPieces.cities = 0;
    setHand(s, 0, RICH);
    expect(cityOptions(s, 0)).toEqual([]);
    expect(errorOf(applyCommand(s, { type: 'buildCity', player: 0, vertex: settlementsOf(s, 0)[0] }))).toBe('no-pieces-left');
  });
});

describe('construir: acciones legales y victoria', () => {
  it('con las manos vacías solo se puede terminar el turno; con recursos aparecen las obras posibles', () => {
    const s = mainPhaseGame();
    expect(legalActions(s, 0).map((a) => a.type)).toEqual(['endTurn']);
    setHand(s, 0, RICH);
    const types = legalActions(s, 0).map((a) => a.type);
    expect(types).toContain('buildRoad');
    expect(types).toContain('buildCity');
    expect(types).toContain('endTurn');
    // cada opción que declara legal el motor la acepta el motor
    for (const a of legalActions(s, 0)) {
      if (a.type === 'buildRoad') for (const edge of a.edges) expect(applyCommand(s, { type: 'buildRoad', player: 0, edge }).ok).toBe(true);
      if (a.type === 'buildSettlement') for (const vertex of a.vertices) expect(applyCommand(s, { type: 'buildSettlement', player: 0, vertex }).ok).toBe(true);
      if (a.type === 'buildCity') for (const vertex of a.vertices) expect(applyCommand(s, { type: 'buildCity', player: 0, vertex }).ok).toBe(true);
    }
  });

  it('al llegar a los puntos para ganar, la partida termina en el acto', () => {
    const s = playSetup(createGame(NAMES, 8, { victoryPoints: 3 }));
    s.phase = { kind: 'main' };
    s.turn = 0;
    setHand(s, 0, RICH);
    const r = must(s, { type: 'buildCity', player: 0, vertex: settlementsOf(s, 0)[0] });
    expect(r.state.phase).toEqual({ kind: 'finished', winner: 0 });
    expect(r.events.at(-1)).toEqual({ type: 'GameWon', player: 0, points: 3 });
    expect(legalActions(r.state, 0)).toEqual([]);
    expect(errorOf(applyCommand(r.state, { type: 'endTurn', player: 0 }))).toBe('game-finished');
  });

  it('con 10 puntos por defecto: 2 poblados + 4 ciudades = 10', () => {
    const s = mainPhaseGame();
    expect(s.config.victoryPoints).toBe(10);
    expect(victoryPoints(s, 0)).toBe(2);
  });
});

// Se usan directamente para cubrir las funciones exportadas sin pasar por applyCommand.
describe('funciones de construcción', () => {
  it('buildRoad/buildSettlement/buildCity devuelven un error (no lanzan) si la fase no es la de juego', () => {
    const s = createGame(NAMES, 1);
    expect(buildRoad(s, 0, 0, [])?.code).toBe('wrong-phase');
    expect(buildSettlement(s, 0, 0, [])?.code).toBe('wrong-phase');
    expect(buildCity(s, 0, 0, [])?.code).toBe('wrong-phase');
  });
});
