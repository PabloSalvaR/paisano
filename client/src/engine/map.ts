// Generación del mapa base: terrenos, fichas de número y puertos, a partir de una topología y una fuente de azar con semilla.

import { HEX_NEIGHBORS, type Topology } from './board';
import { shuffled, type Rng } from './rng';

export type Resource = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains';
export type Terrain = Resource | 'desert';

/** Recurso de cada terreno: bosque→madera, barro→ladrillo, llano→vaca, campo→maíz, cantera→piedra. */
export const RESOURCES: readonly Resource[] = ['forest', 'hills', 'pasture', 'fields', 'mountains'];

const TERRAIN_COUNTS: readonly [Terrain, number][] = [
  ['forest', 4],
  ['pasture', 4],
  ['fields', 4],
  ['hills', 3],
  ['mountains', 3],
  ['desert', 1],
];

const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

/** Posiciones (en la costa ordenada por ángulo) de los 9 puertos: separados por 3, 3 y 4 aristas de forma cíclica. */
const PORT_SLOTS = [0, 3, 6, 10, 13, 16, 20, 23, 26];

export interface Port {
  edge: number; // arista de costa donde está el puerto
  vertices: [number, number]; // los dos vértices que lo usan
  tile: number; // casilla de tierra a la que da la arista
  resource: Resource | null; // null = genérico 3:1; un recurso = específico 2:1
}

export interface GameMap {
  terrains: Terrain[]; // por id de casilla
  numbers: number[]; // por id de casilla; 0 = sin ficha (desierto)
  ports: Port[];
  desert: number; // casilla del desierto, donde arranca el ladrón
}

export function generateMap(topo: Topology, rng: Rng): GameMap {
  const pool: Terrain[] = TERRAIN_COUNTS.flatMap(([t, n]) => Array<Terrain>(n).fill(t));
  if (pool.length !== topo.tiles.length) throw new Error('generateMap: solo soporta el tablero base de 19 casillas');
  const terrains = shuffled(pool, rng);
  const numbers = placeNumbers(topo, terrains, rng);
  return { terrains, numbers, ports: placePorts(topo, rng), desert: terrains.indexOf('desert') };
}

/**
 * Reparto por azar + reintento hasta cumplir dos reglas entre casillas vecinas:
 * los 6 y 8 no pueden ser vecinos, y ninguna casilla lleva el mismo número que una vecina.
 * (Con azar puro ~81 % de los mapas rompen la segunda regla; hacen falta ~5 intentos por mapa.)
 */
function placeNumbers(topo: Topology, terrains: Terrain[], rng: Rng): number[] {
  const neighbors = topo.tiles.map((t) =>
    HEX_NEIGHBORS.map((d) => topo.tileAt(t.q + d.q, t.r + d.r)?.id).filter((id): id is number => id !== undefined),
  );
  for (let attempt = 0; attempt < 10000; attempt++) {
    const tokens = shuffled(NUMBER_TOKENS, rng);
    let next = 0;
    const numbers = terrains.map((t) => (t === 'desert' ? 0 : tokens[next++]));
    if (numbers.every((n, i) => n === 0 || neighbors[i].every((j) => !conflict(n, numbers[j])))) return numbers;
  }
  throw new Error('generateMap: no se encontró un reparto de números válido');
}

function conflict(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  const red = (n: number) => n === 6 || n === 8;
  return a === b || (red(a) && red(b));
}

function placePorts(topo: Topology, rng: Rng): Port[] {
  // aristas de costa ordenadas por el ángulo de su punto medio alrededor del centro
  const coast = topo.edges
    .filter((e) => e.tiles.length === 1)
    .map((e) => {
      const a = topo.vertices[e.a];
      const b = topo.vertices[e.b];
      return { e, angle: Math.atan2((a.z + b.z) / 2, (a.x + b.x) / 2) };
    })
    .sort((p, q) => p.angle - q.angle);
  const kinds = shuffled<Resource | null>([null, null, null, null, ...RESOURCES], rng);
  return PORT_SLOTS.map((slot, i) => {
    const { e } = coast[slot % coast.length];
    return { edge: e.id, vertices: [e.a, e.b], tile: e.tiles[0], resource: kinds[i] };
  });
}
