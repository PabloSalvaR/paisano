// Topología del tablero base (motor de reglas: TypeScript puro, sin imports de React, three ni red).
//
// Mapa hexagonal con la punta hacia arriba (pointy-top), coordenadas axiales (q, r). Circunradio de casilla = 1.
// Los vértices (intersecciones) se deduplican por posición; las aristas son los caminos entre vértices adyacentes.
// Los ids son índices estables: mismo tamaño de mapa = mismos ids siempre (así se pueden guardar en el estado).

export interface Hex {
  q: number;
  r: number;
}

export interface Tile extends Hex {
  id: number;
  x: number; // posición en el mundo (para dibujar)
  z: number;
  vertices: number[]; // las 6 esquinas, k = 0..5 (k = 0 arriba, en sentido antihorario visto desde arriba)
  edges: number[]; // los 6 lados; edges[k] une vertices[k] con vertices[(k + 1) % 6]
}

export interface Vertex {
  id: number;
  x: number;
  z: number;
  tiles: number[]; // casillas que toca (1 a 3)
  neighbors: number[]; // vértices adyacentes (2 o 3)
  edges: number[]; // aristas que salen de él
}

export interface Edge {
  id: number;
  a: number; // vértices que une
  b: number;
  tiles: number[]; // casillas que bordea (1 = arista de costa, 2 = interior)
}

export interface Topology {
  radius: number;
  tiles: Tile[];
  vertices: Vertex[];
  edges: Edge[];
  tileAt(q: number, r: number): Tile | undefined;
  edgeBetween(a: number, b: number): Edge | undefined;
}

const SQ3 = Math.sqrt(3);

/** Vecinos axiales de una casilla, en el orden del CLAUDE.md. */
export const HEX_NEIGHBORS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexToWorld(q: number, r: number): { x: number; z: number } {
  return { x: SQ3 * (q + r / 2), z: 1.5 * r };
}

/** Casillas de un mapa hexagonal de radio `radius` (radio 2 = 19 casillas), por filas r y luego q. */
export function hexesOfRadius(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = Math.max(-radius, -r - radius); q <= Math.min(radius, -r + radius); q++) out.push({ q, r });
  }
  return out;
}

export function buildTopology(radius = 2): Topology {
  const tiles: Tile[] = [];
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const vertexByPos = new Map<string, number>();
  const edgeByKey = new Map<string, number>();

  const vertexId = (x: number, z: number): number => {
    // se redondea a milésimas para que las esquinas compartidas coincidan pese al error de coma flotante
    const key = `${Math.round(x * 1000)},${Math.round(z * 1000)}`;
    let id = vertexByPos.get(key);
    if (id === undefined) {
      id = vertices.length;
      vertexByPos.set(key, id);
      vertices.push({ id, x, z, tiles: [], neighbors: [], edges: [] });
    }
    return id;
  };

  for (const { q, r } of hexesOfRadius(radius)) {
    const { x, z } = hexToWorld(q, r);
    const tile: Tile = { id: tiles.length, q, r, x, z, vertices: [], edges: [] };
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 2 + (k * Math.PI) / 3;
      tile.vertices.push(vertexId(x + Math.cos(a), z - Math.sin(a)));
    }
    for (const v of tile.vertices) vertices[v].tiles.push(tile.id);
    for (let k = 0; k < 6; k++) {
      const a = tile.vertices[k];
      const b = tile.vertices[(k + 1) % 6];
      const key = `${Math.min(a, b)}_${Math.max(a, b)}`;
      let id = edgeByKey.get(key);
      if (id === undefined) {
        id = edges.length;
        edgeByKey.set(key, id);
        edges.push({ id, a, b, tiles: [] });
        vertices[a].neighbors.push(b);
        vertices[b].neighbors.push(a);
        vertices[a].edges.push(id);
        vertices[b].edges.push(id);
      }
      edges[id].tiles.push(tile.id);
      tile.edges.push(id);
    }
    tiles.push(tile);
  }

  const tileByHex = new Map(tiles.map((t) => [`${t.q},${t.r}`, t]));
  return {
    radius,
    tiles,
    vertices,
    edges,
    tileAt: (q, r) => tileByHex.get(`${q},${r}`),
    edgeBetween: (a, b) => {
      const id = edgeByKey.get(`${Math.min(a, b)}_${Math.max(a, b)}`);
      return id === undefined ? undefined : edges[id];
    },
  };
}
