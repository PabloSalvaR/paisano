// Generación del mapa base: terrenos, fichas de número y puertos, a partir de una topología y una fuente de azar con semilla.

import { HEX_NEIGHBORS, type Tile, type Topology } from './board';
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

/**
 * Tipos de puerto del tablero de referencia, en el orden de `PORT_SLOTS` (sentido horario en pantalla: parado en el primer
 * 3:1 y mirando al centro, el maíz queda a la izquierda). null = genérico 3:1. Tiene dos 3:1 juntos, pero nunca tres.
 */
const PORT_SEQUENCE: (Resource | null)[] = [null, 'fields', 'mountains', null, 'pasture', null, null, 'hills', 'forest'];

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

/**
 * Fichas en el orden de sus letras del juego original (A, B, C… R): A5 B2 C6 D3 E8 F10 G9 H12 I11 J4 K8 L10 M9 N4 O5 P6 Q3 R11.
 * Las letras no se muestran: solo fijan el orden en que se colocan en espiral.
 */
const LETTER_TOKENS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

/** Cómo se reparten las fichas de número: al azar (con reintento) o en espiral en el orden de las letras. */
export type NumberPlacement = 'random' | 'spiral';

export function generateMap(topo: Topology, rng: Rng, placement: NumberPlacement = 'random'): GameMap {
  const pool: Terrain[] = TERRAIN_COUNTS.flatMap(([t, n]) => Array<Terrain>(n).fill(t));
  if (pool.length !== topo.tiles.length) throw new Error('generateMap: solo soporta el tablero base de 19 casillas');
  const terrains = shuffled(pool, rng);
  const numbers = placement === 'spiral' ? spiralNumbers(topo, terrains, Math.floor(rng() * 6)) : placeNumbers(topo, terrains, rng);
  return { terrains, numbers, ports: placePorts(topo, rng, placement), desert: terrains.indexOf('desert') };
}

const ringOf = (t: { q: number; r: number }) => Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(t.q + t.r));
// Ángulo visto desde arriba (x a la derecha, -z arriba): crece en sentido antihorario, como los vértices de cada casilla.
const angleOf = (t: { x: number; z: number }) => Math.atan2(-t.z, t.x);

/**
 * Recorrido en espiral del juego original: arranca en una de las 6 esquinas de afuera (`start`, 0..5, en el orden de
 * los ids), da la vuelta al anillo de afuera en sentido antihorario, sigue por el anillo del medio desde la casilla
 * pegada a esa esquina (mismo sentido) y termina en el centro. Siempre pasa de una casilla a una vecina.
 */
export function spiralOrder(topo: Topology, start: number): number[] {
  const corners = topo.tiles.filter((t) => ringOf(t) === 2 && (t.q === 0 || t.r === 0 || t.q + t.r === 0));
  const from = angleOf(corners[start]);
  const turn = (t: Tile) => {
    const d = (((angleOf(t) - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return d > 2 * Math.PI - 1e-9 ? 0 : d; // la esquina de arranque (y la casilla del medio pegada a ella) van primero
  };
  const ring = (k: number) => topo.tiles.filter((t) => ringOf(t) === k).sort((a, b) => turn(a) - turn(b));
  return [...ring(2), ...ring(1), ...ring(0)].map((t) => t.id);
}

/** Números en espiral: las fichas en el orden de las letras a lo largo de `spiralOrder`, salteando el desierto. */
export function spiralNumbers(topo: Topology, terrains: Terrain[], start: number): number[] {
  const numbers = terrains.map(() => 0);
  let next = 0;
  for (const id of spiralOrder(topo, start)) if (terrains[id] !== 'desert') numbers[id] = LETTER_TOKENS[next++];
  return numbers;
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

/**
 * Los 9 puertos van siempre en los mismos lugares de la costa; lo que cambia es el tipo de cada uno. En serie (`'spiral'`), la
 * secuencia del tablero de referencia (`PORT_SEQUENCE`), arrancando en uno de los 3 lugares equivalentes al azar (como el
 * separado 3-3-4 se repite cada 3 puertos, es el mismo dibujo girado 120°). En Caos (`'random'`), al azar, pero nunca tres 3:1
 * seguidos (con puro azar pasaba en ~36 % de los mapas: una costa entera de puertos genéricos).
 */
function placePorts(topo: Topology, rng: Rng, placement: NumberPlacement): Port[] {
  // aristas de costa ordenadas por el ángulo de su punto medio alrededor del centro
  const coast = topo.edges
    .filter((e) => e.tiles.length === 1)
    .map((e) => {
      const a = topo.vertices[e.a];
      const b = topo.vertices[e.b];
      return { e, angle: Math.atan2((a.z + b.z) / 2, (a.x + b.x) / 2) };
    })
    .sort((p, q) => p.angle - q.angle);
  let kinds: (Resource | null)[];
  if (placement === 'spiral') {
    const start = 3 * Math.floor(rng() * 3);
    kinds = PORT_SLOTS.map((_, j) => PORT_SEQUENCE[(j - start + PORT_SEQUENCE.length) % PORT_SEQUENCE.length]);
  } else {
    const threeGeneric = (k: (Resource | null)[]) => k.some((_, i) => [0, 1, 2].every((d) => k[(i + d) % k.length] === null));
    do kinds = shuffled<Resource | null>([null, null, null, null, ...RESOURCES], rng);
    while (threeGeneric(kinds));
  }
  return PORT_SLOTS.map((slot, i) => {
    const { e } = coast[slot % coast.length];
    return { edge: e.id, vertices: [e.a, e.b], tile: e.tiles[0], resource: kinds[i] };
  });
}
