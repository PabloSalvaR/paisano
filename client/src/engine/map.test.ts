import { describe, expect, it } from 'vitest';
import { buildTopology, HEX_NEIGHBORS } from './board';
import { generateMap, RESOURCES, spiralNumbers, spiralOrder, type Terrain } from './map';
import { mulberry32, shuffled } from './rng';

const topo = buildTopology();
const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);
const maps = SEEDS.map((s) => generateMap(topo, mulberry32(s)));

const count = <T>(xs: T[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>());

describe('rng', () => {
  it('con la misma semilla da la misma secuencia, y con otra semilla, otra', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    for (const x of seqA) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('shuffled devuelve una permutación y no modifica el original', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffled(src, mulberry32(7));
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
  });
});

describe('mapa base: terrenos y números', () => {
  it('reparte 4 bosque, 4 llano, 4 campo, 3 barro, 3 cantera y 1 desierto', () => {
    for (const m of maps) {
      const c = count(m.terrains);
      expect([c.get('forest'), c.get('pasture'), c.get('fields'), c.get('hills'), c.get('mountains'), c.get('desert')]).toEqual([
        4, 4, 4, 3, 3, 1,
      ]);
    }
  });

  it('usa exactamente las 18 fichas 2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12 y el desierto no lleva', () => {
    for (const m of maps) {
      const tokens = m.numbers.filter((n) => n !== 0).sort((a, b) => a - b);
      expect(tokens).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      expect(m.numbers[m.desert]).toBe(0);
      expect(m.terrains[m.desert]).toBe('desert');
    }
  });

  it('los 6 y 8 nunca son vecinos y dos vecinas nunca llevan el mismo número (300 semillas)', () => {
    for (const m of maps) {
      for (const t of topo.tiles) {
        const n = m.numbers[t.id];
        if (!n) continue;
        for (const d of HEX_NEIGHBORS) {
          const other = topo.tileAt(t.q + d.q, t.r + d.r);
          if (!other) continue;
          const o = m.numbers[other.id];
          if (!o) continue;
          expect(o).not.toBe(n);
          expect((n === 6 || n === 8) && (o === 6 || o === 8)).toBe(false);
        }
      }
    }
  });
});

describe('mapa base: puertos', () => {
  it('hay 9 puertos: 4 genéricos (3:1) y uno específico (2:1) por cada recurso', () => {
    for (const m of maps) {
      expect(m.ports).toHaveLength(9);
      expect(m.ports.filter((p) => p.resource === null)).toHaveLength(4);
      for (const r of RESOURCES) expect(m.ports.filter((p) => p.resource === r)).toHaveLength(1);
    }
  });

  it('cada puerto está en una arista de costa distinta y sus vértices son los de esa arista', () => {
    for (const m of maps) {
      expect(new Set(m.ports.map((p) => p.edge)).size).toBe(9);
      for (const p of m.ports) {
        const e = topo.edges[p.edge];
        expect(e.tiles).toEqual([p.tile]);
        expect(p.vertices).toEqual([e.a, e.b]);
      }
      // ningún vértice da a dos puertos
      expect(new Set(m.ports.flatMap((p) => p.vertices)).size).toBe(18);
    }
  });

  it('están separados por 3, 3 y 4 aristas de costa de forma cíclica', () => {
    const m = maps[0];
    // se recorre la costa completa en orden angular y se miden los huecos entre puertos
    const coast = topo.edges
      .filter((e) => e.tiles.length === 1)
      .map((e) => ({ id: e.id, angle: Math.atan2((topo.vertices[e.a].z + topo.vertices[e.b].z) / 2, (topo.vertices[e.a].x + topo.vertices[e.b].x) / 2) }))
      .sort((p, q) => p.angle - q.angle)
      .map((c) => c.id);
    const slots = m.ports.map((p) => coast.indexOf(p.edge)).sort((a, b) => a - b);
    const gaps = slots.map((s, i) => (slots[(i + 1) % slots.length] - s + coast.length) % coast.length);
    expect(gaps).toEqual([3, 3, 4, 3, 3, 4, 3, 3, 4]);
  });
});

describe('mapa base: tipos de puerto', () => {
  // la secuencia del tablero de referencia, en sentido horario: parado en el primer 3:1 y mirando al centro, el maíz queda a la izquierda
  const SEQUENCE = [null, 'fields', 'mountains', null, 'pasture', null, null, 'hills', 'forest'];
  const kinds = (m: ReturnType<typeof generateMap>) => m.ports.map((p) => p.resource); // en el orden de la costa (horario en pantalla)
  const threeGeneric = (k: (string | null)[]) => k.some((_, i) => [0, 1, 2].every((d) => k[(i + d) % k.length] === null));

  it('en serie (spiral): la secuencia del tablero, arrancando en uno de los 3 lugares equivalentes (el dibujo girado 120°)', () => {
    const starts = new Set<number>();
    for (const s of SEEDS.slice(0, 90)) {
      const k = kinds(generateMap(topo, mulberry32(s), 'spiral'));
      const start = [0, 3, 6].find((st) => k.every((x, j) => x === SEQUENCE[(j - st + 9) % 9]));
      expect(start).toBeDefined();
      starts.add(start!);
    }
    expect(starts.size).toBe(3);
  });

  it('en Anarquía (random): tipos al azar, pero nunca tres 3:1 seguidos (dos juntos sí, como en el tablero de referencia)', () => {
    let pairs = 0;
    const seen = new Set<string>();
    for (const m of maps) {
      const k = kinds(m);
      expect(threeGeneric(k)).toBe(false);
      if (k.some((x, i) => x === null && k[(i + 1) % 9] === null)) pairs++;
      seen.add(JSON.stringify(k));
    }
    expect(pairs).toBeGreaterThan(0);
    expect(seen.size).toBeGreaterThan(100); // varían de verdad
  });
});

describe('mapa base: determinismo', () => {
  it('la misma semilla da el mismo mapa y semillas distintas dan mapas distintos', () => {
    expect(generateMap(topo, mulberry32(123))).toEqual(generateMap(topo, mulberry32(123)));
    const distinct = new Set(maps.map((m) => JSON.stringify([m.terrains, m.numbers])));
    expect(distinct.size).toBeGreaterThan(290);
  });
});

describe('mapa base: números en espiral (orden de las letras A–R del juego original)', () => {
  // A5 B2 C6 D3 E8 F10 G9 H12 I11 J4 K8 L10 M9 N4 O5 P6 Q3 R11
  const LETTERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
  const center = topo.tileAt(0, 0)!.id;
  const ring = (t: { q: number; r: number }) => Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(t.q + t.r));
  const corners = topo.tiles.filter((t) => ring(t) === 2 && (t.q === 0 || t.r === 0 || t.q + t.r === 0)).map((t) => t.id);
  const adjacent = (a: number, b: number) =>
    HEX_NEIGHBORS.some((d) => topo.tileAt(topo.tiles[a].q + d.q, topo.tiles[a].r + d.r)?.id === b);
  // visto desde arriba (x a la derecha, -z arriba), b está en sentido antihorario respecto de a alrededor del centro
  const ccw = (a: number, b: number) => topo.tiles[a].x * -topo.tiles[b].z - -topo.tiles[a].z * topo.tiles[b].x > 0;
  const withDesert = (d: number) => topo.tiles.map((_, i) => (i === d ? 'desert' : 'forest')) as Terrain[];
  const cases = corners.flatMap((_, start) => topo.tiles.map((t) => ({ start, desert: t.id })));

  it('hay 6 esquinas donde puede arrancar la espiral', () => {
    expect(corners).toHaveLength(6);
  });

  it('arranca en la esquina elegida con la A (5), sigue en sentido antihorario y termina en el centro', () => {
    for (let start = 0; start < 6; start++) {
      const nums = spiralNumbers(topo, withDesert(center), start);
      expect(nums[corners[start]]).toBe(5);
      // la B (2) es la casilla del anillo de afuera pegada a la esquina, del lado antihorario
      const b = topo.tiles.findIndex((_, i) => nums[i] === 2);
      expect(adjacent(corners[start], b)).toBe(true);
      expect(ring(topo.tiles[b])).toBe(2);
      expect(ccw(corners[start], b)).toBe(true);
    }
    // sin desierto en el centro, la última ficha (R = 11) va en el centro
    const desertOuter = topo.tiles.find((t) => ring(t) === 2 && !corners.includes(t.id))!.id;
    expect(spiralNumbers(topo, withDesert(desertOuter), 0)[center]).toBe(11);
  });

  it('pone las 18 fichas en orden alfabético por un camino de casillas vecinas, salteando el desierto', () => {
    for (const { start, desert } of cases) {
      const nums = spiralNumbers(topo, withDesert(desert), start);
      expect(nums[desert]).toBe(0);
      expect([...nums].filter((n) => n > 0).sort((x, y) => x - y)).toEqual([...LETTERS].sort((x, y) => x - y));
    }
    // con el desierto en el centro, el recorrido completo son casillas vecinas una tras otra
    for (let start = 0; start < 6; start++) {
      const nums = spiralNumbers(topo, withDesert(center), start);
      const order = spiralOrder(topo, start).filter((id) => id !== center);
      expect(order.map((id) => nums[id])).toEqual(LETTERS);
      for (let i = 1; i < order.length; i++) expect(adjacent(order[i - 1], order[i])).toBe(true);
    }
  });

  it('esté donde esté el desierto y arranque donde arranque, nunca quedan 6 y 8 vecinos ni dos números iguales pegados', () => {
    for (const { start, desert } of cases) {
      const nums = spiralNumbers(topo, withDesert(desert), start);
      for (const t of topo.tiles) {
        for (const d of HEX_NEIGHBORS) {
          const n = topo.tileAt(t.q + d.q, t.r + d.r);
          const a = nums[t.id];
          const b = n ? nums[n.id] : 0;
          if (!a || !b) continue;
          expect(a === b || ([6, 8].includes(a) && [6, 8].includes(b))).toBe(false);
        }
      }
    }
  });

  it('el recorrido pasa por las 19 casillas una sola vez: 12 de afuera, 6 del medio y el centro', () => {
    for (let start = 0; start < 6; start++) {
      const order = spiralOrder(topo, start);
      expect(new Set(order).size).toBe(19);
      expect(order.map((id) => ring(topo.tiles[id]))).toEqual([...Array(12).fill(2), ...Array(6).fill(1), 0]);
      for (let i = 1; i < order.length; i++) expect(adjacent(order[i - 1], order[i])).toBe(true);
    }
  });

  it('con numberPlacement "spiral", generateMap reparte en espiral desde una esquina al azar (reproducible por semilla)', () => {
    const spiralMaps = SEEDS.slice(0, 60).map((s) => generateMap(topo, mulberry32(s), 'spiral'));
    const starts = new Set<number>();
    for (const m of spiralMaps) {
      const start = corners.findIndex((_, i) => JSON.stringify(spiralNumbers(topo, m.terrains, i)) === JSON.stringify(m.numbers));
      expect(start).toBeGreaterThanOrEqual(0);
      starts.add(start);
    }
    expect(starts.size).toBe(6);
    expect(generateMap(topo, mulberry32(5), 'spiral')).toEqual(generateMap(topo, mulberry32(5), 'spiral'));
  });

  it('el modo aleatorio (por defecto) no cambia: mismo mapa que antes para la misma semilla', () => {
    expect(generateMap(topo, mulberry32(123), 'random')).toEqual(generateMap(topo, mulberry32(123)));
  });
});
