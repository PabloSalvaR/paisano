// Reconocimientos con puntos: la ruta más larga y la milicia más grande.
// Se recalculan cuando algo puede cambiarlos (un camino, una casa que corta, un caballero) y avisan solo si cambia quién los tiene.

import { topology } from './board';
import type { GameEvent, GameState, PlayerId } from './types';

/**
 * Largo del camino continuo más largo del jugador: aristas suyas encadenadas, sin repetir ninguna (un ciclo cuenta todas sus
 * aristas). Una casa o estancia rival en un vértice corta el camino: se puede llegar hasta ahí, pero no seguir.
 */
export function longestRoad(s: GameState, player: PlayerId): number {
  const topo = topology();
  const mine = new Set<number>();
  s.edgeRoads.forEach((p, id) => {
    if (p === player) mine.add(id);
  });
  if (mine.size === 0) return 0;

  let best = 0;
  const used = new Set<number>();
  const walk = (v: number, len: number): void => {
    best = Math.max(best, len);
    const b = s.vertexBuildings[v];
    if (len > 0 && b && b.player !== player) return; // un rival corta: se llega hasta acá y no se sigue
    for (const e of topo.vertices[v].edges) {
      if (!mine.has(e) || used.has(e)) continue;
      used.add(e);
      const edge = topo.edges[e];
      walk(edge.a === v ? edge.b : edge.a, len + 1);
      used.delete(e);
    }
  };
  const starts = new Set<number>();
  for (const e of mine) starts.add(topo.edges[e].a).add(topo.edges[e].b);
  for (const v of starts) walk(v, 0);
  return best;
}

/**
 * Recalcula la ruta más larga. Hace falta un mínimo (5). Quien la tiene la conserva ante un empate y solo la pierde si lo
 * superan; si queda vacante y hay un empate arriba, nadie la tiene.
 */
export function updateLongestRoad(s: GameState, events: GameEvent[]): void {
  const lengths = s.players.map((_, p) => longestRoad(s, p));
  const top = Math.max(...lengths);
  const prev = s.longestRoad.holder;
  let holder: PlayerId | null = null;
  if (top >= s.config.longestRoadMin) {
    const leaders = lengths.flatMap((n, p) => (n === top ? [p] : []));
    if (prev !== null && lengths[prev] === top) holder = prev;
    else if (leaders.length === 1) holder = leaders[0];
  }
  s.longestRoad = { holder, length: holder === null ? 0 : top };
  if (holder !== prev) events.push({ type: 'LongestRoadChanged', player: holder, from: prev, length: s.longestRoad.length });
}

/** Tras jugar un caballero: si quien lo jugó llega al mínimo y supera al que tiene la milicia, se la queda. */
export function updateLargestArmy(s: GameState, player: PlayerId, events: GameEvent[]): void {
  const size = s.players[player].knightsPlayed;
  const { holder } = s.largestArmy;
  if (holder === player) {
    s.largestArmy = { holder, size };
    return;
  }
  if (size < s.config.largestArmyMin) return;
  if (holder !== null && size <= s.players[holder].knightsPlayed) return;
  s.largestArmy = { holder: player, size };
  events.push({ type: 'LargestArmyChanged', player, from: holder, size });
}

/** Recalcula lo que pueda haber cambiado por una jugada de construcción. */
export function updateAwards(s: GameState, events: GameEvent[]): void {
  updateLongestRoad(s, events);
}
