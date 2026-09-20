import { describe, expect, it } from 'vitest';
import { buildTopology, HEX_NEIGHBORS } from './board';
import { generateMap, RESOURCES } from './map';
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

describe('mapa base: determinismo', () => {
  it('la misma semilla da el mismo mapa y semillas distintas dan mapas distintos', () => {
    expect(generateMap(topo, mulberry32(123))).toEqual(generateMap(topo, mulberry32(123)));
    const distinct = new Set(maps.map((m) => JSON.stringify([m.terrains, m.numbers])));
    expect(distinct.size).toBeGreaterThan(290);
  });
});
