// Reglas de la partida: creación, comandos (applyCommand) y acciones legales (legalActions).
// La construcción vive en build.ts y el ladrón en robber.ts; acá está el flujo de fases (colocación inicial, dados, turnos).

import { topology } from './board';
import { buildCity, buildRoad, buildSettlement, cityOptions, roadOptions, roadPlaces, settlementOptions } from './build';
import { defaultConfig } from './config';
import { buyDevCard, devPlayOptions, playKnight, playMonopoly, playRoadBuilding, playYearOfPlenty, shuffledDeck, yearOfPlentyOptions } from './devcards';
import { rollDiceFor } from './dice';
import { bad, canAfford, canSettleAt, emptyDev, emptyHand, give, type Err } from './helpers';
import { generateMap, RESOURCES, type Resource } from './map';
import { mulberry32 } from './rng';
import { bankTrade, bankTradeOptions } from './trade';
import { discard, moveRobber, startSeven, steal } from './robber';
import type {
  Command,
  ErrorCode,
  GameConfig,
  GameEvent,
  GameState,
  Gain,
  LegalAction,
  PlayerId,
  Result,
} from './types';

// ---------------------------------------------------------------- creación

/** Crea una partida nueva. `names` en orden de mesa (el primero arranca). La semilla decide mapa, dados y robos. */
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
    players: names.map((name) => ({ name, hand: emptyHand(), dev: emptyDev(), devNew: emptyDev(), knightsPlayed: 0 })),
    bank,
    vertexBuildings: topo.vertices.map(() => null),
    edgeRoads: topo.edges.map(() => null),
    robber: map.desert,
    phase: { kind: 'setup', step: 0, part: 'settlement', lastSettlement: null },
    turn: 0,
    dice: { seed: (seed ^ 0x5bd1e995) | 0, rolls: 0 }, // flujos de azar separados del del mapa
    random: { seed: (seed ^ 0x2545f491) | 0, count: 0 },
    devDeck: shuffledDeck(cfg.devDeck, (seed ^ 0x3c6ef372) | 0), // flujo aparte, igual que dados y robos
    devPlayed: false,
    longestRoad: { holder: null, length: 0 },
    largestArmy: { holder: null, size: 0 },
  };
}

/** Jugador que actúa en el paso `step` de la colocación inicial: 0..n-1 y luego n-1..0 (el último juega dos veces seguidas). */
export function setupPlayer(step: number, players: number): PlayerId {
  return step < players ? step : 2 * players - 1 - step;
}

// ---------------------------------------------------------------- acciones legales

export function legalActions(state: GameState, player: PlayerId): LegalAction[] {
  const phase = state.phase;
  if (phase.kind === 'finished' || player !== state.turn) return [];
  switch (phase.kind) {
    case 'setup': {
      const topo = topology();
      if (phase.part === 'settlement') {
        return [{ type: 'placeSettlement', vertices: topo.vertices.map((v) => v.id).filter((id) => canSettleAt(state, id)) }];
      }
      return [{ type: 'placeRoad', edges: topo.vertices[phase.lastSettlement!].edges.filter((e) => state.edgeRoads[e] === null) }];
    }
    case 'roll':
      return [{ type: 'rollDice' }, ...devActions(state, player)]; // antes de tirar solo se puede jugar el Gaucho
    case 'main': {
      const actions: LegalAction[] = [];
      const roads = roadOptions(state, player);
      const settlements = settlementOptions(state, player);
      const cities = cityOptions(state, player);
      if (roads.length) actions.push({ type: 'buildRoad', edges: roads });
      if (settlements.length) actions.push({ type: 'buildSettlement', vertices: settlements });
      if (cities.length) actions.push({ type: 'buildCity', vertices: cities });
      const trades = bankTradeOptions(state, player);
      if (trades.length) actions.push({ type: 'bankTrade', trades });
      if (state.devDeck.length && canAfford(state.players[player].hand, state.config.costs.developmentCard)) actions.push({ type: 'buyDevCard' });
      actions.push(...devActions(state, player));
      actions.push({ type: 'endTurn' });
      return actions;
    }
    case 'discard':
      return [{ type: 'discard', count: phase.queue[0].count }];
    case 'moveRobber':
      return [{ type: 'moveRobber', tiles: state.map.terrains.map((_, id) => id).filter((id) => id !== state.robber) }];
    case 'steal':
      return [{ type: 'steal', victims: phase.victims }];
    case 'roadBuilding':
      return [{ type: 'buildRoad', edges: roadPlaces(state, player) }];
  }
}

/** Las cartas de desarrollo que el jugador puede jugar en la fase actual. */
function devActions(state: GameState, player: PlayerId): LegalAction[] {
  return devPlayOptions(state, player).map((type): LegalAction => {
    if (type === 'playYearOfPlenty') return { type, resources: yearOfPlentyOptions(state) };
    return { type };
  });
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

function run(s: GameState, cmd: Command, events: GameEvent[]): Err {
  switch (cmd.type) {
    case 'placeSettlement':
      return placeSettlement(s, cmd.player, cmd.vertex, events);
    case 'placeRoad':
      return placeRoad(s, cmd.player, cmd.edge, events);
    case 'rollDice':
      return rollDice(s, cmd.player, events);
    case 'buildRoad':
      return buildRoad(s, cmd.player, cmd.edge, events);
    case 'buildSettlement':
      return buildSettlement(s, cmd.player, cmd.vertex, events);
    case 'buildCity':
      return buildCity(s, cmd.player, cmd.vertex, events);
    case 'discard':
      return discard(s, cmd.player, cmd.cards, events);
    case 'moveRobber':
      return moveRobber(s, cmd.player, cmd.tile, events);
    case 'steal':
      return steal(s, cmd.player, cmd.victim, events);
    case 'bankTrade':
      return bankTrade(s, cmd.player, cmd.give, cmd.get, events);
    case 'buyDevCard':
      return buyDevCard(s, cmd.player, events);
    case 'playKnight':
      return playKnight(s, cmd.player, events);
    case 'playMonopoly':
      return playMonopoly(s, cmd.player, cmd.resource, events);
    case 'playYearOfPlenty':
      return playYearOfPlenty(s, cmd.player, cmd.resources, events);
    case 'playRoadBuilding':
      return playRoadBuilding(s, cmd.player, events);
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
  if (total === 7) {
    startSeven(s, player, events); // nadie cobra: descarte, ladrón y robo
  } else {
    const gains = produce(s, total);
    if (gains.length) events.push({ type: 'ResourcesDistributed', gains });
    s.phase = { kind: 'main' };
  }
  return null;
}

function endTurn(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Primero hay que tirar los dados.');
  s.players[player].devNew = emptyDev(); // lo comprado en este turno ya se puede jugar desde el próximo
  s.devPlayed = false;
  s.turn = (player + 1) % s.players.length;
  s.phase = { kind: 'roll' };
  events.push({ type: 'TurnChanged', player: s.turn, phase: 'roll' });
  return null;
}

// ---------------------------------------------------------------- producción

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

