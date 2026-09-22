// Construcción en el turno normal: caminos, casas y estancias.

import { topology } from './board';
import { updateLongestRoad } from './awards';
import { bad, canAfford, canSettleAt, checkWin, pay, pieceCounts, type Err } from './helpers';
import type { GameEvent, GameState, Phase, PlayerId } from './types';

// ---------------------------------------------------------------- opciones (qué se puede construir y dónde)

/** ¿La arista se conecta con la red del jugador? Sirve una casa/estancia propia en un extremo, o un camino propio que
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

/** Aristas donde el jugador podría poner un camino (le queden piezas y salga de su red), sin mirar si le alcanza para pagarlo. */
export function roadPlaces(s: GameState, player: PlayerId): number[] {
  if (pieceCounts(s, player).roads >= s.config.maxPieces.roads) return [];
  return topology()
    .edges.map((e) => e.id)
    .filter((id) => s.edgeRoads[id] === null && roadConnects(s, player, id));
}

/** Aristas donde el jugador puede construir un camino ahora (vacío si no le alcanzan los recursos o no le quedan piezas). */
export function roadOptions(s: GameState, player: PlayerId): number[] {
  return canAfford(s.players[player].hand, s.config.costs.road) ? roadPlaces(s, player) : [];
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

/** Tras cada camino gratis: si no queda ninguno por poner, o no hay dónde, se vuelve a la fase principal. */
export function afterFreeRoad(s: GameState, player: PlayerId, events: GameEvent[]): void {
  if (s.phase.kind !== 'roadBuilding') return;
  const { after } = s.phase;
  const left = s.phase.left - 1;
  updateLongestRoad(s, events);
  checkWin(s, player, events);
  if ((s.phase as Phase).kind === 'finished') return; // ganó con el reconocimiento
  s.phase = left > 0 && roadPlaces(s, player).length > 0 ? { kind: 'roadBuilding', left, after } : { kind: after };
}

export function buildRoad(s: GameState, player: PlayerId, edge: number, events: GameEvent[]): Err {
  const free = s.phase.kind === 'roadBuilding'; // carta Empedrado: el camino no se paga
  if (s.phase.kind !== 'main' && !free) return bad('wrong-phase', 'Solo se puede construir después de tirar los dados.');
  const topo = topology();
  if (!Number.isInteger(edge) || edge < 0 || edge >= topo.edges.length) return bad('invalid-edge', 'Esa arista no existe.');
  if (s.edgeRoads[edge] !== null) return bad('occupied', 'Ya hay un camino ahí.');
  if (!roadConnects(s, player, edge)) return bad('not-connected', 'El camino tiene que salir de tu red (una casa, una estancia u otro camino tuyo).');
  if (pieceCounts(s, player).roads >= s.config.maxPieces.roads) return bad('no-pieces-left', 'No te quedan caminos.');
  const cost = s.config.costs.road;
  if (!free && !canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Un camino cuesta 1 madera y 1 ladrillo.');
  if (!free) pay(s, player, cost);
  s.edgeRoads[edge] = player;
  if (!free) events.push({ type: 'ResourcesSpent', player, cost });
  events.push({ type: 'RoadBuilt', player, edge });
  if (free) afterFreeRoad(s, player, events);
  else {
    updateLongestRoad(s, events);
    checkWin(s, player, events);
  }
  return null;
}

export function buildSettlement(s: GameState, player: PlayerId, vertex: number, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede construir después de tirar los dados.');
  const topo = topology();
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= topo.vertices.length) return bad('invalid-vertex', 'Ese vértice no existe.');
  if (s.vertexBuildings[vertex] !== null) return bad('occupied', 'Ya hay una pieza en ese vértice.');
  if (!canSettleAt(s, vertex)) return bad('too-close', 'Hay que dejar al menos dos caminos de distancia a otra casa o estancia.');
  if (!settlementConnects(s, player, vertex)) return bad('not-connected', 'La casa tiene que estar al final de un camino tuyo.');
  if (pieceCounts(s, player).settlements >= s.config.maxPieces.settlements) return bad('no-pieces-left', 'No te quedan casas (mejorá alguna a estancia).');
  const cost = s.config.costs.settlement;
  if (!canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Una casa cuesta 1 madera, 1 ladrillo, 1 vaca y 1 maíz.');
  pay(s, player, cost);
  s.vertexBuildings[vertex] = { player, city: false };
  events.push({ type: 'ResourcesSpent', player, cost }, { type: 'SettlementBuilt', player, vertex });
  updateLongestRoad(s, events); // una casa puede cortar el camino de un rival
  checkWin(s, player, events);
  return null;
}

export function buildCity(s: GameState, player: PlayerId, vertex: number, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede construir después de tirar los dados.');
  const topo = topology();
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= topo.vertices.length) return bad('invalid-vertex', 'Ese vértice no existe.');
  const b = s.vertexBuildings[vertex];
  if (!b || b.player !== player || b.city) return bad('invalid-target', 'Una estancia se construye sobre una casa tuya.');
  if (pieceCounts(s, player).cities >= s.config.maxPieces.cities) return bad('no-pieces-left', 'No te quedan estancias.');
  const cost = s.config.costs.city;
  if (!canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Una estancia cuesta 2 maíz y 3 piedras.');
  pay(s, player, cost);
  b.city = true; // la casa vuelve a la reserva del jugador (se cuenta por lo que hay en el tablero)
  events.push({ type: 'ResourcesSpent', player, cost }, { type: 'CityBuilt', player, vertex });
  checkWin(s, player, events);
  return null;
}
