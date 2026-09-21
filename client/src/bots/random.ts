// Bot aleatorio: el más simple posible, pensado para probar. Usa la misma interfaz que un jugador: recibe lo que ve
// (sus acciones legales y su mano) y devuelve un comando. Para uno más inteligente basta con otra función `Bot`.

import { RESOURCES } from '../engine';
import type { Command, Hand, LegalAction, PlayerId, Resource, Rng } from '../engine';

export interface BotInput {
  me: PlayerId;
  legal: LegalAction[];
  hand: Hand;
}

export type Bot = (input: BotInput, rng: Rng) => Command;

/** Convierte una acción legal en un comando concreto, eligiendo al azar entre sus opciones. */
export function commandFor(a: LegalAction, player: PlayerId, hand: Hand, rng: Rng): Command {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
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
      const pool = RESOURCES.flatMap((r) => Array<Resource>(hand[r]).fill(r));
      for (let i = 0; i < a.count; i++) {
        const k = Math.floor(rng() * pool.length);
        const r = pool.splice(k, 1)[0];
        cards[r] = (cards[r] ?? 0) + 1;
      }
      return { type: 'discard', player, cards };
    }
    case 'bankTrade': {
      const t = pick(a.trades);
      return { type: 'bankTrade', player, give: t.give, get: pick(t.get) };
    }
    case 'playMonopoly':
      return { type: a.type, player, resource: pick(RESOURCES) };
    case 'playYearOfPlenty':
      return { type: a.type, player, resources: Array.from({ length: a.count }, () => pick(a.resources)) };
    case 'rollDice':
    case 'endTurn':
    case 'buyDevCard':
    case 'playKnight':
    case 'playRoadBuilding':
      return { type: a.type, player };
  }
}

/** Acciones «activas»: construir, comprar y jugar cartas (todo menos tirar, comerciar y terminar el turno). */
export const isActive = (a: LegalAction): boolean => a.type.startsWith('build') || a.type === 'buyDevCard' || a.type.startsWith('play');

/** Prefiere hacer algo a terminar el turno (si no, casi nunca construiría); lo demás lo elige al azar. */
export const randomBot: Bot = ({ me, legal, hand }, rng) => {
  const active = legal.filter(isActive);
  const pool = active.length && rng() < 0.85 ? active : legal;
  return commandFor(pool[Math.floor(rng() * pool.length)], me, hand, rng);
};
