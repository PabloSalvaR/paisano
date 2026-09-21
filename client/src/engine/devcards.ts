// Cartas de desarrollo: el mazo, comprarlas y jugarlas.
//   Gaucho (knight): mueve al ladrón y roba, sin descarte. Se puede jugar antes de tirar los dados.
//   Acopio (monopoly): todos los rivales entregan el recurso elegido. Buena cosecha (yearOfPlenty): 2 recursos del banco.
//   Vialidad (roadBuilding): 2 caminos gratis. Estancia (victoryPoint): 1 punto oculto, no se «juega».
// Una carta por turno, y no la que se compró ese mismo turno.

import { roadPlaces } from './build';
import { updateLargestArmy } from './awards';
import { bad, canAfford, checkWin, give, pay, pieceCounts, type Err } from './helpers';
import { RESOURCES, type Resource } from './map';
import { mulberry32 } from './rng';
import type { DevCardKind, GameEvent, GameState, Phase, PlayerId } from './types';

const KINDS: DevCardKind[] = ['knight', 'victoryPoint', 'monopoly', 'yearOfPlenty', 'roadBuilding'];

/** Arma el mazo con la composición de `config.devDeck` y lo baraja con la semilla (Fisher-Yates). */
export function shuffledDeck(counts: GameState['config']['devDeck'], seed: number): DevCardKind[] {
  const deck = KINDS.flatMap((k) => Array<DevCardKind>(counts[k]).fill(k));
  const rng = mulberry32(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Cuántas cartas de ese tipo puede jugar ahora: las que tiene menos las compradas en este turno. */
export function playable(s: GameState, player: PlayerId, kind: DevCardKind): number {
  const p = s.players[player];
  return p.dev[kind] - p.devNew[kind];
}

const canPlay = (s: GameState, player: PlayerId, kind: DevCardKind): boolean => !s.devPlayed && playable(s, player, kind) > 0;

/** Recursos que el banco todavía tiene (los que se pueden pedir con Buena cosecha). */
const bankHas = (s: GameState): Resource[] => RESOURCES.filter((r) => s.bank[r] > 0);

/** Qué cartas puede jugar el jugador en la fase actual (para `legalActions`). */
export function devPlayOptions(s: GameState, player: PlayerId): ('playKnight' | 'playMonopoly' | 'playYearOfPlenty' | 'playRoadBuilding')[] {
  const out: ('playKnight' | 'playMonopoly' | 'playYearOfPlenty' | 'playRoadBuilding')[] = [];
  const phase = s.phase.kind;
  if (phase !== 'roll' && phase !== 'main') return out;
  if (canPlay(s, player, 'knight')) out.push('playKnight');
  if (phase !== 'main') return out; // antes de tirar solo el Gaucho
  if (canPlay(s, player, 'monopoly')) out.push('playMonopoly');
  if (canPlay(s, player, 'yearOfPlenty') && bankHas(s).reduce((n, r) => n + s.bank[r], 0) >= 2) out.push('playYearOfPlenty');
  if (canPlay(s, player, 'roadBuilding') && roadPlaces(s, player).length > 0) out.push('playRoadBuilding');
  return out;
}

export function yearOfPlentyOptions(s: GameState): Resource[] {
  return bankHas(s);
}

export function buyDevCard(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede comprar una carta después de tirar los dados.');
  const cost = s.config.costs.developmentCard;
  if (!canAfford(s.players[player].hand, cost)) return bad('insufficient-resources', 'Una carta cuesta 1 vaca, 1 maíz y 1 piedra.');
  const kind = s.devDeck.pop();
  if (!kind) return bad('deck-empty', 'Ya no quedan cartas en el mazo.');
  pay(s, player, cost);
  const p = s.players[player];
  p.dev[kind]++;
  p.devNew[kind]++;
  events.push({ type: 'ResourcesSpent', player, cost }, { type: 'DevCardBought', player, kind });
  if (kind === 'victoryPoint') checkWin(s, player, events); // el punto oculto puede completar los 10
  return null;
}

/** Valida lo común a jugar una carta: la tiene (no nueva) y no jugó otra en este turno. Descuenta la carta y marca el turno. */
function spend(s: GameState, player: PlayerId, kind: DevCardKind): Err {
  if (playable(s, player, kind) <= 0) return bad('no-card', 'No tenés esa carta (o la compraste en este turno).');
  if (s.devPlayed) return bad('already-played', 'Ya jugaste una carta en este turno.');
  s.players[player].dev[kind]--;
  s.devPlayed = true;
  return null;
}

export function playKnight(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  const phase = s.phase.kind;
  if (phase !== 'roll' && phase !== 'main') return bad('wrong-phase', 'Ahora no se puede jugar esa carta.');
  const err = spend(s, player, 'knight');
  if (err) return err;
  s.players[player].knightsPlayed++;
  events.push({ type: 'KnightPlayed', player });
  updateLargestArmy(s, player, events);
  checkWin(s, player, events);
  if ((s.phase as Phase).kind !== 'finished') s.phase = { kind: 'moveRobber', after: phase }; // (checkWin pudo terminar la partida)
  return null;
}

export function playMonopoly(s: GameState, player: PlayerId, resource: Resource, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Esa carta se juega después de tirar los dados.');
  if (!RESOURCES.includes(resource)) return bad('invalid-target', 'Ese recurso no existe.');
  const err = spend(s, player, 'monopoly');
  if (err) return err;
  const taken: { player: PlayerId; amount: number }[] = [];
  s.players.forEach((other, id) => {
    if (id === player || other.hand[resource] === 0) return;
    taken.push({ player: id, amount: other.hand[resource] });
    s.players[player].hand[resource] += other.hand[resource];
    other.hand[resource] = 0;
  });
  events.push({ type: 'MonopolyPlayed', player, resource, taken });
  return null;
}

export function playYearOfPlenty(s: GameState, player: PlayerId, resources: [Resource, Resource], events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Esa carta se juega después de tirar los dados.');
  if (!Array.isArray(resources) || resources.length !== 2 || !resources.every((r) => RESOURCES.includes(r))) {
    return bad('invalid-target', 'Tenés que elegir 2 recursos.');
  }
  const need = new Map<Resource, number>();
  for (const r of resources) need.set(r, (need.get(r) ?? 0) + 1);
  for (const [r, n] of need) if (s.bank[r] < n) return bad('bank-empty', 'El banco no tiene tantas cartas de ese recurso.');
  const err = spend(s, player, 'yearOfPlenty');
  if (err) return err;
  const gains = resources.flatMap((r) => give(s, player, r, 1));
  events.push({ type: 'YearOfPlentyPlayed', player, gains });
  return null;
}

export function playRoadBuilding(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Esa carta se juega después de tirar los dados.');
  if (roadPlaces(s, player).length === 0) return bad('no-pieces-left', 'No tenés dónde poner caminos.');
  const err = spend(s, player, 'roadBuilding');
  if (err) return err;
  s.phase = { kind: 'roadBuilding', left: Math.min(2, s.config.maxPieces.roads - pieceCounts(s, player).roads) };
  events.push({ type: 'RoadBuildingPlayed', player });
  return null;
}
