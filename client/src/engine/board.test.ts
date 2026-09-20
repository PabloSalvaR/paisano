import { describe, expect, it } from 'vitest';
import { buildTopology, hexToWorld, HEX_NEIGHBORS } from './board';

const topo = buildTopology();

describe('tablero base: conteos', () => {
  it('tiene 19 casillas, 54 vértices y 72 aristas', () => {
    expect(topo.tiles).toHaveLength(19);
    expect(topo.vertices).toHaveLength(54);
    expect(topo.edges).toHaveLength(72);
  });

  it('tiene 30 aristas de costa (las que bordean una sola casilla) y 42 interiores', () => {
    expect(topo.edges.filter((e) => e.tiles.length === 1)).toHaveLength(30);
    expect(topo.edges.filter((e) => e.tiles.length === 2)).toHaveLength(42);
  });

  it('los ids son índices consecutivos', () => {
    topo.tiles.forEach((t, i) => expect(t.id).toBe(i));
    topo.vertices.forEach((v, i) => expect(v.id).toBe(i));
    topo.edges.forEach((e, i) => expect(e.id).toBe(i));
  });
});

describe('tablero base: invariantes', () => {
  it('cada vértice toca entre 1 y 3 casillas', () => {
    for (const v of topo.vertices) {
      expect(v.tiles.length).toBeGreaterThanOrEqual(1);
      expect(v.tiles.length).toBeLessThanOrEqual(3);
    }
  });

  it('cada casilla tiene 6 vértices distintos: 19 × 6 = 114 incidencias', () => {
    expect(topo.vertices.reduce((n, v) => n + v.tiles.length, 0)).toBe(114);
    for (const t of topo.tiles) expect(new Set(t.vertices).size).toBe(6);
  });

  it('cada arista une exactamente 2 vértices distintos y adyacentes', () => {
    for (const e of topo.edges) {
      expect(e.a).not.toBe(e.b);
      expect(topo.vertices[e.a].neighbors).toContain(e.b);
      expect(topo.vertices[e.b].neighbors).toContain(e.a);
      expect(topo.vertices[e.a].edges).toContain(e.id);
      expect(topo.vertices[e.b].edges).toContain(e.id);
    }
  });

  it('la adyacencia es simétrica y cada vértice tiene 2 o 3 vecinos', () => {
    for (const v of topo.vertices) {
      expect(v.neighbors.length).toBeGreaterThanOrEqual(2);
      expect(v.neighbors.length).toBeLessThanOrEqual(3);
      expect(v.edges).toHaveLength(v.neighbors.length);
      for (const n of v.neighbors) expect(topo.vertices[n].neighbors).toContain(v.id);
    }
  });

  it('la casilla central no toca la costa y una casilla de esquina tiene 3 aristas de costa', () => {
    const center = topo.tileAt(0, 0)!;
    expect(center.edges.every((id) => topo.edges[id].tiles.length === 2)).toBe(true);
    const corner = topo.tileAt(2, -2)!;
    expect(corner.edges.filter((id) => topo.edges[id].tiles.length === 1)).toHaveLength(3);
  });

  it('edgeBetween encuentra la arista en cualquier orden y devuelve undefined si no son adyacentes', () => {
    const e = topo.edges[0];
    expect(topo.edgeBetween(e.a, e.b)).toBe(e);
    expect(topo.edgeBetween(e.b, e.a)).toBe(e);
    const far = topo.vertices.find((v) => v.id !== e.a && !topo.vertices[e.a].neighbors.includes(v.id))!;
    expect(topo.edgeBetween(e.a, far.id)).toBeUndefined();
  });
});

describe('tablero base: geometría', () => {
  it('posición en el mundo según las fórmulas del CLAUDE.md', () => {
    expect(hexToWorld(0, 0)).toEqual({ x: 0, z: 0 });
    const p = hexToWorld(1, 1);
    expect(p.x).toBeCloseTo(Math.sqrt(3) * 1.5);
    expect(p.z).toBeCloseTo(1.5);
    for (const t of topo.tiles) expect({ x: t.x, z: t.z }).toEqual(hexToWorld(t.q, t.r));
  });

  it('las esquinas de una casilla están a distancia 1 de su centro', () => {
    for (const t of topo.tiles) {
      for (const vid of t.vertices) {
        const v = topo.vertices[vid];
        expect(Math.hypot(v.x - t.x, v.z - t.z)).toBeCloseTo(1);
      }
    }
  });

  it('las casillas vecinas comparten exactamente 2 vértices y 1 arista', () => {
    for (const t of topo.tiles) {
      for (const d of HEX_NEIGHBORS) {
        const n = topo.tileAt(t.q + d.q, t.r + d.r);
        if (!n) continue;
        expect(t.vertices.filter((v) => n.vertices.includes(v))).toHaveLength(2);
        expect(t.edges.filter((e) => n.edges.includes(e))).toHaveLength(1);
      }
    }
  });

  it('es determinista: dos construcciones dan los mismos ids y conexiones', () => {
    const again = buildTopology();
    expect(again.vertices.map((v) => v.tiles)).toEqual(topo.vertices.map((v) => v.tiles));
    expect(again.edges.map((e) => [e.a, e.b])).toEqual(topo.edges.map((e) => [e.a, e.b]));
  });
});
