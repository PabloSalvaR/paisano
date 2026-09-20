// Construcción en el turno normal: caminos, poblados y ciudades.

import { topology } from './board';
import { bad, canAfford, canSettleAt, pay, pieceCounts, victoryPoints, type Err } from './helpers';
import type { GameEvent, GameState, PlayerId } from './types';

// ---------------------------------------------------------------- opciones (qué se puede construir y dónde)

/** ¿La arista se conecta con la red del jugador? Sirve un poblado/ciudad propio en un extremo, o un camino propio que
 *  llegue a un extremo que no esté ocupado por un rival (un rival "corta" el camino). */
function roadConnects(s: GameState, player: PlayerId, edge: number): boolean {
  const topo = topology();
  const e = topo.edges[edge];
  return [e.a, e.b].some((v) => {
    const b = s.vertexBuildings[v];
    if (b) return b.player === player;
    return topo.vertices[v].edges.some((id) => id !== edge && s.edgeRoads[id] === player);
  });
}

function settlementConnects(s: GameState, player: PlayerId, vertex: number): boolean {
  return topology().vertices[vertex].edges.some((id) => s.edgeRoads[id] === player);
}

/** Aristas donde el jugador puede poner un camino ahora (vacío si no le alcanzan los recursos o no le quedan piezas). */
export function roadOptions(s: GameState, player: PlayerId): number[] {
  if (pieceCounts(s, player).roads >= s.config.maxPieces.roads || !canAfford(s.players[player].hand, s.config.costs.road)) return [];
  return topology()
    .edges.map((e) => e.id)
    .filter((id) => s.edgeRoads[id] === null && roadConnects(s, player, id));
}

export function settlementOptions(s: GameState, player: PlayerId): number[] {
  if (pieceCounts(s, player).settlements >= s.config.maxPieces.settlements || !canAfford(s.players[player].hand, s.config.costs.settlement)) return [];
  return topology()
    .vertices.map((v) => v.id)
    .filter((id) => canSettleAt(s, id) && settlementConnects(s, player, id));
}

export function cityOptions(s: GameState, player: PlayerId): number[] {
  if (pieceCounts(s, player).cities >= s.config.maxPieces.cities || !canAfford(s.players[player].hand, s.config.costs.city)) return [];
  return topology()
    .vertices.map((v) => v.id)
    .filter((id) => s.vertexBuildings[id]?.player === player && !s.vertexBuildings[id]!.city);
}

// ---------------------------------------------------------------- comandos

function checkWin(s: GameState, player: PlayerId, events: GameEvent[]): void {
  const points = victoryPoints(s, player);
  if (points >= s.config.victoryPoints) {
    s.phase = { kind: 'finished', winner: player };
    events.push({ type: 'GameWon', player, points });
  }
}

export function buildRoad(s: GameState, player: PlayerId, edge: number, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede construir después de tirar los dados.');
  const topo = topology();
  if (!Number.isInteger(edge) || edge < 0 || edge >= topo.edges.length) return bad('invalid-edge', 'Esa arista no existe.');
  if (s.edgeRoads[edge] !== null) return bad('occupied', 'Ya hay un camino ahí.');
  if (!roadConnects(s, player, edge)) return bad('not-connected', 'El camino tiene que salir de tu red (un poblado, una ciudad u otro camino tuyo).');
  if (pieceCounts(s, player).roads >= s.config.maxPieces.roads) return bad('no-pieces-left', 'No te quedan caminos.');
  const cost = s.config.costs.road;
  if (!canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Un camino cuesta 1 madera y 1 ladrillo.');
  pay(s, player, cost);
  s.edgeRoads[edge] = player;
  events.push({ type: 'ResourcesSpent', player, cost }, { type: 'RoadBuilt', player, edge });
  return null;
}

export function buildSettlement(s: GameState, player: PlayerId, vertex: number, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede construir después de tirar los dados.');
  const topo = topology();
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= topo.vertices.length) return bad('invalid-vertex', 'Ese vértice no existe.');
  if (s.vertexBuildings[vertex] !== null) return bad('occupied', 'Ya hay una pieza en ese vértice.');
  if (!canSettleAt(s, vertex)) return bad('too-close', 'Hay que dejar al menos dos caminos de distancia a otro poblado o ciudad.');
  if (!settlementConnects(s, player, vertex)) return bad('not-connected', 'El poblado tiene que estar al final de un camino tuyo.');
  if (pieceCounts(s, player).settlements >= s.config.maxPieces.settlements) return bad('no-pieces-left', 'No te quedan poblados (mejorá alguno a ciudad).');
  const cost = s.config.costs.settlement;
  if (!canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Un poblado cuesta 1 madera, 1 ladrillo, 1 vaca y 1 maíz.');
  pay(s, player, cost);
  s.vertexBuildings[vertex] = { player, city: false };
  events.push({ type: 'ResourcesSpent', player, cost }, { type: 'SettlementBuilt', player, vertex });
  checkWin(s, player, events);
  return null;
}

export function buildCity(s: GameState, player: PlayerId, vertex: number, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede construir después de tirar los dados.');
  const topo = topology();
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= topo.vertices.length) return bad('invalid-vertex', 'Ese vértice no existe.');
  const b = s.vertexBuildings[vertex];
  if (!b || b.player !== player || b.city) return bad('invalid-target', 'Una ciudad se construye sobre un poblado tuyo.');
  if (pieceCounts(s, player).cities >= s.config.maxPieces.cities) return bad('no-pieces-left', 'No te quedan ciudades.');
  const cost = s.config.costs.city;
  if (!canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Una ciudad cuesta 2 maíz y 3 piedras.');
  pay(s, player, cost);
  b.city = true; // el poblado vuelve a la reserva del jugador (se cuenta por lo que hay en el tablero)
  events.push({ type: 'ResourcesSpent', player, cost }, { type: 'CityBuilt', player, vertex });
  checkWin(s, player, events);
  return null;
}
