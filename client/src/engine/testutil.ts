// Ayudas compartidas por los tests del motor (no es un archivo de tests: Vitest solo corre *.test.ts).

import { expect } from 'vitest';
import { applyCommand, createGame, legalActions } from './game';
import { RESOURCES, type Resource } from './map';
import type { Command, GameEvent, GameState, Hand, LegalAction, PlayerId, Result } from './types';

export const NAMES = ['Tomás', 'Lucía', 'Mateo', 'Sofía'];

/** Aplica un comando que tiene que ser legal; si no, el test falla con el error. */
export function must(state: GameState, cmd: Command): { state: GameState; events: GameEvent[] } {
  const r = applyCommand(state, cmd);
  if (!r.ok) throw new Error(`${cmd.type} rechazado: ${r.error.code} — ${r.error.message}`);
  return r;
}

export function errorOf(r: Result): string {
  if (r.ok) throw new Error('se esperaba un error');
  return r.error.code;
}

/** Juega la colocación inicial completa eligiendo siempre la primera opción legal. */
export function playSetup(state: GameState): GameState {
  let s = state;
  while (s.phase.kind === 'setup') {
    const p = s.turn;
    const a = legalActions(s, p)[0];
    if (a.type === 'placeSettlement') s = must(s, { type: 'placeSettlement', player: p, vertex: a.vertices[0] }).state;
    else if (a.type === 'placeRoad') s = must(s, { type: 'placeRoad', player: p, edge: a.edges[0] }).state;
  }
  return s;
}

/** Partida lista en el turno del jugador 0, ya tirados los dados (fase "main"), con las manos vacías. */
export function mainPhaseGame(seed = 8, names = NAMES): GameState {
  const s = { ...playSetup(createGame(names, seed)) };
  s.phase = { kind: 'main' };
  s.turn = 0;
  clearHands(s);
  return s;
}

/** Devuelve todas las cartas de las manos al banco. */
export function clearHands(s: GameState): void {
  for (const p of s.players) {
    for (const r of RESOURCES) {
      s.bank[r] += p.hand[r];
      p.hand[r] = 0;
    }
  }
}

/** Le da cartas al jugador sacándolas del banco (para armar situaciones a mano sin romper la conservación). */
export function setHand(s: GameState, player: PlayerId, hand: Partial<Hand>): void {
  for (const r of RESOURCES) {
    const want = hand[r] ?? 0;
    const have = s.players[player].hand[r];
    s.bank[r] -= want - have;
    s.players[player].hand[r] = want;
  }
}

export const RICH: Hand = { forest: 5, hills: 5, pasture: 5, fields: 5, mountains: 5 };

export const totalOf = (s: GameState, r: Resource): number => s.bank[r] + s.players.reduce((n, p) => n + p.hand[r], 0);

export function expectConserved(s: GameState): void {
  for (const r of RESOURCES) {
    expect(totalOf(s, r)).toBe(s.config.bankPerResource);
    expect(s.bank[r]).toBeGreaterThanOrEqual(0);
    for (const p of s.players) expect(p.hand[r]).toBeGreaterThanOrEqual(0);
  }
}

/** Convierte una acción legal en un comando concreto, eligiendo al azar entre sus opciones. */
export function commandFor(a: LegalAction, player: PlayerId, rng: () => number, state: GameState): Command {
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  switch (a.type) {
    case 'placeSettlement':
    case 'buildSettlement':
    case 'buildCity':
      return { type: a.type, player, vertex: pick(a.vertices) };
    case 'placeRoad':
    case 'buildRoad':
      return { type: a.type, player, edge: pick(a.edges) };
    case 'moveRobber':
      return { type: a.type, player, tile: pick(a.tiles) };
    case 'steal':
      return { type: a.type, player, victim: pick(a.victims) };
    case 'discard': {
      // descarta `count` cartas al azar de su mano
      const cards: Partial<Hand> = {};
      const pool = RESOURCES.flatMap((r) => Array<Resource>(state.players[player].hand[r]).fill(r));
      for (let i = 0; i < a.count; i++) {
        const k = Math.floor(rng() * pool.length);
        const r = pool.splice(k, 1)[0];
        cards[r] = (cards[r] ?? 0) + 1;
      }
      return { type: 'discard', player, cards };
    }
    case 'rollDice':
    case 'endTurn':
      return { type: a.type, player };
  }
}
