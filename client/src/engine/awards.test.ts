// Camino más largo: cálculo de la longitud (ramas, ciclos, cortes por poblados rivales) y quién lo tiene (mínimo 5, empates).

import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { longestRoad, updateAwards } from './awards';
import { applyCommand } from './game';
import { mainPhaseGame, must, setHand, RICH } from './testutil';
import type { GameEvent, GameState, PlayerId } from './types';

const topo = topology();

const edgeBetween = (a: number, b: number): number => topo.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))!.id;

/** Un camino simple de `len` aristas que sale del vértice `from` sin tocar `avoid`: devuelve sus aristas y vértices. */
function pathFrom(from: number, len: number, avoid: Set<number> = new Set(), banned: Set<number> = new Set()): { edges: number[]; vertices: number[] } {
  const vertices = [from];
  const edges: number[] = [];
  const go = (): boolean => {
    if (edges.length === len) return true;
    const v = vertices[vertices.length - 1];
    for (const e of topo.vertices[v].edges) {
      const w = topo.edges[e].a === v ? topo.edges[e].b : topo.edges[e].a;
      if (avoid.has(e) || edges.includes(e) || vertices.includes(w) || banned.has(w)) continue;
      edges.push(e);
      vertices.push(w);
      if (go()) return true;
      edges.pop();
      vertices.pop();
    }
    return false;
  };
  if (!go()) throw new Error('no hay camino de esa longitud');
  return { edges, vertices };
}

/** Partida sin piezas en el tablero: cada test arma su red a mano. */
function emptyBoard(): GameState {
  const s = mainPhaseGame();
  s.edgeRoads = s.edgeRoads.map(() => null);
  s.vertexBuildings = s.vertexBuildings.map(() => null);
  return s;
}

const road = (s: GameState, player: PlayerId, edges: number[]): void => edges.forEach((e) => (s.edgeRoads[e] = player));

describe('longestRoad: longitud del camino continuo más largo', () => {
  it('sin caminos es 0, y una cadena mide sus aristas', () => {
    const s = emptyBoard();
    expect(longestRoad(s, 0)).toBe(0);
    road(s, 0, pathFrom(0, 6).edges);
    expect(longestRoad(s, 0)).toBe(6);
  });

  it('con una bifurcación cuenta la rama más larga, no la suma', () => {
    const s = emptyBoard();
    const trunk = pathFrom(0, 3);
    road(s, 0, trunk.edges);
    const end = trunk.vertices[3];
    const branchA = pathFrom(end, 3, new Set(trunk.edges), new Set(trunk.vertices)); // sigue 3 más, sin volver al tronco (formaría un ciclo)
    const taken = new Set([...trunk.vertices, ...branchA.vertices]);
    const otherWay = (e: number): number => (topo.edges[e].a === end ? topo.edges[e].b : topo.edges[e].a);
    const branchB = topo.vertices[end].edges.find((e) => !trunk.edges.includes(e) && !branchA.edges.includes(e) && !taken.has(otherWay(e)))!;
    road(s, 0, [...branchA.edges, branchB]);
    // tronco (3) + la rama larga (3) = 6; la rama corta (1) no se suma: un camino no puede recorrer las dos
    expect(longestRoad(s, 0)).toBe(6);
  });

  it('un ciclo cuenta todas sus aristas (un hexágono cerrado mide 6)', () => {
    const s = emptyBoard();
    const ring = topo.tiles[9].vertices; // casilla del medio, vértices en orden
    for (let i = 0; i < 6; i++) s.edgeRoads[edgeBetween(ring[i], ring[(i + 1) % 6])] = 0;
    expect(longestRoad(s, 0)).toBe(6);
  });

  it('un poblado rival en el medio corta el camino; en la punta no', () => {
    const s = emptyBoard();
    const p = pathFrom(0, 6);
    road(s, 0, p.edges);
    s.vertexBuildings[p.vertices[3]] = { player: 1, city: false }; // parte 3 + 3
    expect(longestRoad(s, 0)).toBe(3);
    s.vertexBuildings[p.vertices[3]] = null;
    s.vertexBuildings[p.vertices[6]] = { player: 1, city: false }; // en el extremo: se puede llegar hasta ahí
    expect(longestRoad(s, 0)).toBe(6);
  });

  it('un poblado propio en el medio no corta', () => {
    const s = emptyBoard();
    const p = pathFrom(0, 6);
    road(s, 0, p.edges);
    s.vertexBuildings[p.vertices[3]] = { player: 0, city: true };
    expect(longestRoad(s, 0)).toBe(6);
  });

  it('los caminos de otro jugador no cuentan ni cortan', () => {
    const s = emptyBoard();
    const p = pathFrom(0, 6);
    road(s, 0, p.edges.slice(0, 3));
    road(s, 1, p.edges.slice(3));
    expect(longestRoad(s, 0)).toBe(3);
    expect(longestRoad(s, 1)).toBe(3);
  });
});

describe('updateAwards: quién tiene el camino más largo', () => {
  const run = (s: GameState): GameEvent[] => {
    const events: GameEvent[] = [];
    updateAwards(s, events);
    return events;
  };

  it('hacen falta 5: con 4 nadie lo tiene, con 5 sí (y avisa)', () => {
    const s = emptyBoard();
    const p = pathFrom(0, 5);
    road(s, 0, p.edges.slice(0, 4));
    expect(run(s)).toEqual([]);
    expect(s.longestRoad).toEqual({ holder: null, length: 0 });
    road(s, 0, [p.edges[4]]);
    expect(run(s)).toEqual([{ type: 'LongestRoadChanged', player: 0, from: null, length: 5 }]);
    expect(s.longestRoad).toEqual({ holder: 0, length: 5 });
  });

  it('quien lo tiene lo conserva ante un empate y lo pierde solo si lo superan', () => {
    const s = emptyBoard();
    const a = pathFrom(0, 5);
    road(s, 0, a.edges);
    run(s);
    const b = pathFrom(topo.vertices.length - 1, 5, new Set(a.edges));
    road(s, 1, b.edges);
    expect(run(s)).toEqual([]); // 5 contra 5: sigue el 0
    expect(s.longestRoad.holder).toBe(0);
    const more = topo.vertices[b.vertices[5]].edges.find((e) => s.edgeRoads[e] === null && !a.edges.includes(e))!;
    road(s, 1, [more]);
    expect(run(s)).toEqual([{ type: 'LongestRoadChanged', player: 1, from: 0, length: 6 }]);
    expect(s.longestRoad).toEqual({ holder: 1, length: 6 });
  });

  it('si lo cortan y queda un empate entre los demás, nadie lo tiene; si queda uno solo por encima, es suyo', () => {
    const s = emptyBoard();
    const a = pathFrom(0, 6);
    road(s, 0, a.edges);
    run(s);
    expect(s.longestRoad.holder).toBe(0);
    const b = pathFrom(topo.vertices.length - 1, 5, new Set(a.edges));
    road(s, 1, b.edges);
    s.vertexBuildings[a.vertices[3]] = { player: 2, city: false }; // el 0 baja a 3
    expect(run(s)).toEqual([{ type: 'LongestRoadChanged', player: 1, from: 0, length: 5 }]);
    const c = pathFrom(b.vertices[0] === 0 ? 1 : 2, 5, new Set([...a.edges, ...b.edges]));
    road(s, 2, c.edges); // 1 y 2 empatan en 5 y ninguno lo tenía... pero el 1 ya lo tiene: lo conserva
    expect(run(s)).toEqual([]);
    // ahora el 1 pierde el suyo por un corte: quedan el 2 con 5 y nadie más ≥ 5 → pasa al 2
    s.vertexBuildings[b.vertices[2]] = { player: 3, city: false };
    expect(run(s)).toEqual([{ type: 'LongestRoadChanged', player: 2, from: 1, length: 5 }]);
  });

  it('si el que lo tiene cae por debajo de 5 y nadie llega, queda vacante', () => {
    const s = emptyBoard();
    const a = pathFrom(0, 5);
    road(s, 0, a.edges);
    run(s);
    s.vertexBuildings[a.vertices[2]] = { player: 1, city: false };
    expect(run(s)).toEqual([{ type: 'LongestRoadChanged', player: null, from: 0, length: 0 }]);
    expect(s.longestRoad).toEqual({ holder: null, length: 0 });
  });
});

describe('camino más largo dentro del juego', () => {
  it('construir el 5.º camino da el reconocimiento y suma 2 puntos', () => {
    const s = emptyBoard();
    const p = pathFrom(0, 5);
    s.vertexBuildings[p.vertices[0]] = { player: 0, city: false };
    road(s, 0, p.edges.slice(0, 4));
    setHand(s, 0, RICH);
    const r = must(s, { type: 'buildRoad', player: 0, edge: p.edges[4] });
    expect(r.events.map((e) => e.type)).toEqual(['ResourcesSpent', 'RoadBuilt', 'LongestRoadChanged']);
    expect(r.state.longestRoad).toEqual({ holder: 0, length: 5 });
  });

  it('un poblado que corta el camino de otro se lo quita', () => {
    const s = emptyBoard();
    const p = pathFrom(0, 5);
    s.vertexBuildings[p.vertices[0]] = { player: 0, city: false };
    road(s, 0, p.edges);
    s.longestRoad = { holder: 0, length: 5 };
    // el jugador 1 tiene un camino que llega a p.vertices[2] por otro lado y construye ahí
    const spur = topo.vertices[p.vertices[2]].edges.find((e) => !p.edges.includes(e))!;
    const far = topo.edges[spur].a === p.vertices[2] ? topo.edges[spur].b : topo.edges[spur].a;
    s.edgeRoads[spur] = 1;
    s.turn = 1;
    setHand(s, 1, RICH);
    const r = applyCommand(s, { type: 'buildSettlement', player: 1, vertex: p.vertices[2] });
    expect(far).toBeDefined();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.events.some((e) => e.type === 'LongestRoadChanged' && e.from === 0 && e.player === null)).toBe(true);
  });
});
