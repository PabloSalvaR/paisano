// El ladrón: se activa con un 7 (descarte, mover al ladrón, robar).
// Pendiente para cuando haya cartas de desarrollo: el caballero también mueve al ladrón, sin descarte.

import { topology } from './board';
import { bad, handTotal, pickInt, type Err } from './helpers';
import { RESOURCES, type Resource } from './map';
import type { GameEvent, GameState, Hand, PlayerId } from './types';

/** Arranca la secuencia del 7: descarte de quienes tengan de más y después el ladrón de quien tiró. */
export function startSeven(s: GameState, roller: PlayerId, events: GameEvent[]): void {
  const n = s.players.length;
  const queue: { player: PlayerId; count: number }[] = [];
  for (let i = 0; i < n; i++) {
    const player = (roller + i) % n;
    const total = handTotal(s.players[player].hand);
    if (total > s.config.discardLimit) queue.push({ player, count: Math.floor(total / 2) });
  }
  if (queue.length) {
    s.phase = { kind: 'discard', roller, queue };
    s.turn = queue[0].player;
    events.push({ type: 'DiscardRequired', players: queue });
  } else {
    s.phase = { kind: 'moveRobber' };
  }
}

export function discard(s: GameState, player: PlayerId, cards: Partial<Hand>, events: GameEvent[]): Err {
  const phase = s.phase;
  if (phase.kind !== 'discard') return bad('wrong-phase', 'Ahora nadie tiene que descartar.');
  const need = phase.queue[0].count;
  let total = 0;
  for (const r of RESOURCES) {
    const n = cards[r] ?? 0;
    if (!Number.isInteger(n) || n < 0) return bad('invalid-discard', 'Cantidad de cartas inválida.');
    if (n > s.players[player].hand[r]) return bad('invalid-discard', 'No tenés esas cartas.');
    total += n;
  }
  if (total !== need) return bad('invalid-discard', `Tenés que descartar exactamente ${need} cartas.`);

  const given: Partial<Hand> = {};
  for (const r of RESOURCES) {
    const n = cards[r] ?? 0;
    if (n === 0) continue;
    s.players[player].hand[r] -= n;
    s.bank[r] += n;
    given[r] = n;
  }
  events.push({ type: 'Discarded', player, cards: given });

  phase.queue.shift();
  if (phase.queue.length) s.turn = phase.queue[0].player;
  else {
    s.turn = phase.roller;
    s.phase = { kind: 'moveRobber' };
  }
  return null;
}

/** Rivales con poblado o ciudad junto a la casilla y al menos una carta en la mano (a esos se les puede robar). */
export function robberVictims(s: GameState, mover: PlayerId, tile: number): PlayerId[] {
  const found = new Set<PlayerId>();
  for (const v of topology().tiles[tile].vertices) {
    const b = s.vertexBuildings[v];
    if (b && b.player !== mover && handTotal(s.players[b.player].hand) > 0) found.add(b.player);
  }
  return [...found].sort((a, b) => a - b);
}

export function moveRobber(s: GameState, player: PlayerId, tile: number, events: GameEvent[]): Err {
  if (s.phase.kind !== 'moveRobber') return bad('wrong-phase', 'Ahora no se mueve al ladrón.');
  if (!Number.isInteger(tile) || tile < 0 || tile >= s.map.terrains.length) return bad('invalid-tile', 'Esa casilla no existe.');
  if (tile === s.robber) return bad('same-tile', 'El ladrón tiene que moverse a otra casilla.');
  s.robber = tile;
  events.push({ type: 'RobberMoved', player, tile });

  const victims = robberVictims(s, player, tile);
  if (victims.length === 0) s.phase = { kind: 'main' };
  else if (victims.length === 1) {
    stealFrom(s, player, victims[0], events);
    s.phase = { kind: 'main' };
  } else s.phase = { kind: 'steal', victims };
  return null;
}

export function steal(s: GameState, player: PlayerId, victim: PlayerId, events: GameEvent[]): Err {
  const phase = s.phase;
  if (phase.kind !== 'steal') return bad('wrong-phase', 'Ahora no se roba.');
  if (!phase.victims.includes(victim)) return bad('invalid-victim', 'Ese jugador no tiene un poblado junto al ladrón (o no tiene cartas).');
  stealFrom(s, player, victim, events);
  s.phase = { kind: 'main' };
  return null;
}

/** Le saca una carta al azar (cada carta de la mano tiene la misma chance) al rival. */
function stealFrom(s: GameState, thief: PlayerId, victim: PlayerId, events: GameEvent[]): void {
  const cards: Resource[] = RESOURCES.flatMap((r) => Array<Resource>(s.players[victim].hand[r]).fill(r));
  const resource = cards[pickInt(s, cards.length)];
  s.players[victim].hand[resource]--;
  s.players[thief].hand[resource]++;
  events.push({ type: 'Stolen', thief, victim, resource });
}
