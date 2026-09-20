// Reglas de la partida: creación, comandos (applyCommand) y acciones legales (legalActions).
// Por ahora: colocación inicial, tirada de dados con producción y fin de turno. Construir, ladrón y comercio vienen después.

import { buildTopology, type Topology } from './board';
import { defaultConfig } from './config';
import { rollDiceFor } from './dice';
import { generateMap, RESOURCES, type Resource } from './map';
import { mulberry32 } from './rng';
import type {
  Command,
  ErrorCode,
  GameConfig,
  GameEvent,
  GameState,
  Gain,
  Hand,
  LegalAction,
  PlayerId,
  Result,
} from './types';

let cachedTopology: Topology | undefined;
/** Topología del tablero base (no se guarda en el estado: se deduce y es idéntica siempre). */
export function topology(): Topology {
  return (cachedTopology ??= buildTopology());
}

const emptyHand = (): Hand => ({ forest: 0, hills: 0, pasture: 0, fields: 0, mountains: 0 });

// ---------------------------------------------------------------- creación

/** Crea una partida nueva. `names` en orden de mesa (el primero arranca). La semilla decide mapa y dados. */
export function createGame(names: string[], seed: number, config?: Partial<GameConfig>): GameState {
  if (names.length < 3 || names.length > 4) throw new Error('createGame: la partida es de 3 o 4 jugadores');
  const cfg: GameConfig = { ...defaultConfig(names.length), ...config, players: names.length };
  const topo = topology();
  const map = generateMap(topo, mulberry32(seed));
  const bank = emptyHand();
  for (const r of RESOURCES) bank[r] = cfg.bankPerResource;
  return {
    config: cfg,
    map,
    players: names.map((name) => ({ name, hand: emptyHand() })),
    bank,
    vertexBuildings: topo.vertices.map(() => null),
    edgeRoads: topo.edges.map(() => null),
    robber: map.desert,
    phase: { kind: 'setup', step: 0, part: 'settlement', lastSettlement: null },
    turn: 0,
    dice: { seed: (seed ^ 0x5bd1e995) | 0, rolls: 0 }, // flujo de dados separado del del mapa
  };
}

/** Jugador que actúa en el paso `step` de la colocación inicial: 0..n-1 y luego n-1..0 (el último juega dos veces seguidas). */
export function setupPlayer(step: number, players: number): PlayerId {
  return step < players ? step : 2 * players - 1 - step;
}

// ---------------------------------------------------------------- consultas de tablero

/** Un poblado necesita el vértice libre y a 2 aristas o más de cualquier otro poblado o ciudad (regla de distancia). */
export function canSettleAt(state: GameState, vertex: number): boolean {
  const v = topology().vertices[vertex];
  return !!v && state.vertexBuildings[vertex] === null && v.neighbors.every((n) => state.vertexBuildings[n] === null);
}

function setupSettlementOptions(state: GameState): number[] {
  return topology()
    .vertices.map((v) => v.id)
    .filter((id) => canSettleAt(state, id));
}

function setupRoadOptions(state: GameState, from: number): number[] {
  return topology().vertices[from].edges.filter((e) => state.edgeRoads[e] === null);
}

// ---------------------------------------------------------------- acciones legales

export function legalActions(state: GameState, player: PlayerId): LegalAction[] {
  const phase = state.phase;
  if (phase.kind === 'finished' || player !== state.turn) return [];
  switch (phase.kind) {
    case 'setup':
      if (phase.part === 'settlement') return [{ type: 'placeSettlement', vertices: setupSettlementOptions(state) }];
      return [{ type: 'placeRoad', edges: setupRoadOptions(state, phase.lastSettlement!) }];
    case 'roll':
      return [{ type: 'rollDice' }];
    case 'main':
      return [{ type: 'endTurn' }];
  }
}

// ---------------------------------------------------------------- comandos

const fail = (code: ErrorCode, message: string): Result => ({ ok: false, error: { code, message } });

/**
 * Valida y aplica un comando. No modifica el estado recibido: devuelve uno nuevo y la lista de eventos, o un error claro.
 * Nunca lanza por un comando ilegal.
 */
export function applyCommand(state: GameState, cmd: Command): Result {
  if (state.phase.kind === 'finished') return fail('game-finished', 'La partida ya terminó.');
  if (!Number.isInteger(cmd.player) || cmd.player < 0 || cmd.player >= state.players.length) {
    return fail('unknown-player', 'Jugador desconocido.');
  }
  if (cmd.player !== state.turn) return fail('not-your-turn', 'No es tu turno.');

  const next = structuredClone(state); // mutación encapsulada: el estado original queda intacto
  const events: GameEvent[] = [];
  const err = run(next, cmd, events);
  return err ? { ok: false, error: err } : { ok: true, state: next, events };
}

type Err = { code: ErrorCode; message: string } | null;
const bad = (code: ErrorCode, message: string): Err => ({ code, message });

function run(s: GameState, cmd: Command, events: GameEvent[]): Err {
  switch (cmd.type) {
    case 'placeSettlement':
      return placeSettlement(s, cmd.player, cmd.vertex, events);
    case 'placeRoad':
      return placeRoad(s, cmd.player, cmd.edge, events);
    case 'rollDice':
      return rollDice(s, cmd.player, events);
    case 'endTurn':
      return endTurn(s, cmd.player, events);
  }
}

function placeSettlement(s: GameState, player: PlayerId, vertex: number, events: GameEvent[]): Err {
  const phase = s.phase;
  if (phase.kind !== 'setup' || phase.part !== 'settlement') return bad('wrong-phase', 'Ahora no corresponde colocar un poblado.');
  const topo = topology();
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= topo.vertices.length) return bad('invalid-vertex', 'Ese vértice no existe.');
  if (s.vertexBuildings[vertex] !== null) return bad('occupied', 'Ya hay una pieza en ese vértice.');
  if (!canSettleAt(s, vertex)) return bad('too-close', 'Hay que dejar al menos dos caminos de distancia a otro poblado o ciudad.');

  s.vertexBuildings[vertex] = { player, city: false };
  events.push({ type: 'SettlementBuilt', player, vertex });

  // El 2.º poblado (segunda vuelta) da un recurso por cada casilla que toca; el desierto no da nada.
  if (phase.step >= s.players.length) {
    const gains: Gain[] = [];
    for (const t of topo.vertices[vertex].tiles) {
      const terrain = s.map.terrains[t];
      if (terrain === 'desert') continue;
      gains.push(...give(s, player, terrain, 1));
    }
    if (gains.length) events.push({ type: 'ResourcesDistributed', gains });
  }
  phase.part = 'road';
  phase.lastSettlement = vertex;
  return null;
}

function placeRoad(s: GameState, player: PlayerId, edge: number, events: GameEvent[]): Err {
  const phase = s.phase;
  if (phase.kind !== 'setup' || phase.part !== 'road') return bad('wrong-phase', 'Ahora no corresponde colocar un camino.');
  const topo = topology();
  if (!Number.isInteger(edge) || edge < 0 || edge >= topo.edges.length) return bad('invalid-edge', 'Esa arista no existe.');
  if (s.edgeRoads[edge] !== null) return bad('occupied', 'Ya hay un camino ahí.');
  const e = topo.edges[edge];
  if (e.a !== phase.lastSettlement && e.b !== phase.lastSettlement) {
    return bad('not-connected', 'El camino inicial tiene que salir del poblado que acabás de colocar.');
  }

  s.edgeRoads[edge] = player;
  events.push({ type: 'RoadBuilt', player, edge });

  const n = s.players.length;
  const step = phase.step + 1;
  if (step === 2 * n) {
    s.phase = { kind: 'roll' }; // termina la colocación: empieza la primera ronda de dados desde el jugador 1
    s.turn = 0;
    events.push({ type: 'TurnChanged', player: 0, phase: 'roll' });
  } else {
    s.phase = { kind: 'setup', step, part: 'settlement', lastSettlement: null };
    s.turn = setupPlayer(step, n);
    events.push({ type: 'TurnChanged', player: s.turn, phase: 'setup' });
  }
  return null;
}

function rollDice(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  if (s.phase.kind !== 'roll') return bad('wrong-phase', 'Ahora no se puede tirar los dados.');
  const dice = rollDiceFor(s.dice.seed, s.dice.rolls);
  s.dice.rolls++;
  const total = dice[0] + dice[1];
  events.push({ type: 'DiceRolled', player, dice, total });
  // TODO (ladrón): con un 7 habrá descarte de manos grandes, mover al ladrón y robar. Por ahora no produce nada.
  if (total !== 7) {
    const gains = produce(s, total);
    if (gains.length) events.push({ type: 'ResourcesDistributed', gains });
  }
  s.phase = { kind: 'main' };
  return null;
}

function endTurn(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Primero hay que tirar los dados.');
  s.turn = (player + 1) % s.players.length;
  s.phase = { kind: 'roll' };
  events.push({ type: 'TurnChanged', player: s.turn, phase: 'roll' });
  return null;
}

// ---------------------------------------------------------------- producción y banco

/** Pasa cartas del banco a un jugador. Devuelve lo que realmente se entregó (nunca más de lo que hay en el banco). */
function give(s: GameState, player: PlayerId, resource: Resource, amount: number): Gain[] {
  const n = Math.min(amount, s.bank[resource]);
  if (n <= 0) return [];
  s.bank[resource] -= n;
  s.players[player].hand[resource] += n;
  return [{ player, resource, amount: n }];
}

/**
 * Producción de una tirada (distinta de 7): cada casilla con esa ficha, salvo la del ladrón, da 1 carta por poblado
 * y 2 por ciudad. Si el banco no alcanza para un recurso: si lo cobra un solo jugador recibe lo que quede;
 * si lo cobran varios, nadie recibe ese recurso (regla oficial).
 */
function produce(s: GameState, total: number): Gain[] {
  const topo = topology();
  const owed = new Map<Resource, Map<PlayerId, number>>();
  for (const tile of topo.tiles) {
    const terrain = s.map.terrains[tile.id];
    if (terrain === 'desert' || s.map.numbers[tile.id] !== total || s.robber === tile.id) continue;
    for (const vid of tile.vertices) {
      const b = s.vertexBuildings[vid];
      if (!b) continue;
      const byPlayer = owed.get(terrain) ?? new Map<PlayerId, number>();
      byPlayer.set(b.player, (byPlayer.get(b.player) ?? 0) + (b.city ? 2 : 1));
      owed.set(terrain, byPlayer);
    }
  }
  const gains: Gain[] = [];
  for (const resource of RESOURCES) {
    const byPlayer = owed.get(resource);
    if (!byPlayer) continue;
    const demand = [...byPlayer.values()].reduce((a, b) => a + b, 0);
    if (demand > s.bank[resource] && byPlayer.size > 1) continue; // el banco no alcanza y hay varios: nadie cobra
    for (const [player, amount] of [...byPlayer.entries()].sort((a, b) => a[0] - b[0])) {
      gains.push(...give(s, player, resource, amount));
    }
  }
  return gains;
}
