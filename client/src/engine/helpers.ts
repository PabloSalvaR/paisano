// Utilidades compartidas por las reglas (construcción, ladrón, colocación inicial).

import { topology } from './board';
import { RESOURCES, type Resource } from './map';
import { mulberry32 } from './rng';
import type { Cost, DevHand, ErrorCode, GameEvent, Gain, GameState, Hand, PlayerId } from './types';

export type Err = { code: ErrorCode; message: string } | null;
export const bad = (code: ErrorCode, message: string): Err => ({ code, message });

export const emptyHand = (): Hand => ({ forest: 0, hills: 0, pasture: 0, fields: 0, mountains: 0 });
export const emptyDev = (): DevHand => ({ knight: 0, monopoly: 0, yearOfPlenty: 0, roadBuilding: 0, victoryPoint: 0 });
export const handTotal = (h: Hand): number => RESOURCES.reduce((n, r) => n + h[r], 0);

/** Una casa necesita el vértice libre y a 2 aristas o más de cualquier otra casa o estancia (regla de distancia). */
export function canSettleAt(state: GameState, vertex: number): boolean {
  const v = topology().vertices[vertex];
  return !!v && state.vertexBuildings[vertex] === null && v.neighbors.every((n) => state.vertexBuildings[n] === null);
}

export function pieceCounts(state: GameState, player: PlayerId) {
  return {
    roads: state.edgeRoads.filter((p) => p === player).length,
    settlements: state.vertexBuildings.filter((b) => b?.player === player && !b.city).length,
    cities: state.vertexBuildings.filter((b) => b?.player === player && b.city).length,
  };
}

/** Puntos que ven todos: casas (1), estancias (2) y los reconocimientos de ruta y milicia. */
export function publicVictoryPoints(state: GameState, player: PlayerId): number {
  const c = pieceCounts(state, player);
  const awards = (state.longestRoad.holder === player ? 1 : 0) + (state.largestArmy.holder === player ? 1 : 0);
  return c.settlements + 2 * c.cities + awards * state.config.awardPoints;
}

/** Puntos reales: los públicos más las cartas de Punto de victoria, que solo conoce su dueño. */
export function victoryPoints(state: GameState, player: PlayerId): number {
  return publicVictoryPoints(state, player) + state.players[player].dev.victoryPoint;
}

/** Si quien actúa llegó a los puntos para ganar (contando sus cartas ocultas), termina la partida. */
export function checkWin(s: GameState, player: PlayerId, events: GameEvent[]): void {
  const points = victoryPoints(s, player);
  if (points >= s.config.victoryPoints) {
    s.phase = { kind: 'finished', winner: player };
    events.push({ type: 'GameWon', player, points });
  }
}

export function canAfford(hand: Hand, cost: Cost): boolean {
  return RESOURCES.every((r) => hand[r] >= (cost[r] ?? 0));
}

/** El jugador le paga `cost` al banco. Quien llama ya verificó que puede pagarlo. */
export function pay(s: GameState, player: PlayerId, cost: Cost): void {
  for (const r of RESOURCES) {
    const n = cost[r] ?? 0;
    s.players[player].hand[r] -= n;
    s.bank[r] += n;
  }
}

/** Pasa cartas del banco a un jugador. Devuelve lo que realmente se entregó (nunca más de lo que hay en el banco). */
export function give(s: GameState, player: PlayerId, resource: Resource, amount: number): Gain[] {
  const n = Math.min(amount, s.bank[resource]);
  if (n <= 0) return [];
  s.bank[resource] -= n;
  s.players[player].hand[resource] += n;
  return [{ player, resource, amount: n }];
}

/** Entero al azar en [0, max) del flujo `random` del estado (semilla + contador, igual que los dados). */
export function pickInt(s: GameState, max: number): number {
  const rng = mulberry32((s.random.seed + Math.imul(s.random.count + 1, 0x9e3779b1)) | 0);
  rng();
  s.random.count++;
  return Math.floor(rng() * max);
}
