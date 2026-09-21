// Comercio entre jugadores. Solo el jugador de turno propone (en fase `main`); los demás aceptan o rechazan y quien propuso
// elige con cuál de los que aceptaron concreta el cambio (así no hay carrera por ser el primero: importa con bots y con polling).
// Sin contraofertas. Mientras hay una oferta abierta no se puede hacer nada más que responderla, cancelarla o concretarla.

import { bad, type Err } from './helpers';
import { RESOURCES, type Resource } from './map';
import type { GameEvent, GameState, Hand, LegalAction, PlayerId, TradeOffer } from './types';

/** Deja solo recursos válidos con cantidad entera positiva; null si algo es inválido. */
function clean(cards: Partial<Hand>): Partial<Hand> | null {
  const out: Partial<Hand> = {};
  for (const [k, n] of Object.entries(cards ?? {})) {
    if (!RESOURCES.includes(k as Resource)) return null;
    if (!Number.isInteger(n) || (n as number) < 0) return null;
    if ((n as number) > 0) out[k as Resource] = n as number;
  }
  return out;
}

const has = (hand: Hand, cards: Partial<Hand>): boolean => RESOURCES.every((r) => hand[r] >= (cards[r] ?? 0));
const count = (cards: Partial<Hand>): number => RESOURCES.reduce((n, r) => n + (cards[r] ?? 0), 0);

export const offersLeft = (s: GameState): number => Math.max(0, s.config.trade.maxOffersPerTurn - (s.tradeOffers ?? 0));

export function proposeTrade(s: GameState, player: PlayerId, giveRaw: Partial<Hand>, getRaw: Partial<Hand>, toRaw: PlayerId[] | undefined, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede comerciar después de tirar los dados.');
  if (s.trade) return bad('trade-open', 'Ya hay una oferta abierta.');
  if (offersLeft(s) <= 0) return bad('trade-limit', `Ya hiciste ${s.config.trade.maxOffersPerTurn} ofertas en este turno.`);
  const give = clean(giveRaw);
  const get = clean(getRaw);
  if (!give || !get) return bad('invalid-trade', 'La oferta tiene un recurso o una cantidad inválidos.');
  if (!count(give) || !count(get)) return bad('invalid-trade', 'Hay que ofrecer algo y pedir algo a cambio.');
  if (RESOURCES.some((r) => give[r] && get[r])) return bad('invalid-trade', 'No podés ofrecer y pedir el mismo recurso.');
  if (!has(s.players[player].hand, give)) return bad('insufficient-resources', 'No tenés las cartas que ofrecés.');

  const others = s.players.map((_, i) => i).filter((i) => i !== player);
  const to = toRaw ?? others;
  if (!Array.isArray(to) || !to.length || new Set(to).size !== to.length || to.some((p) => !others.includes(p))) {
    return bad('invalid-target', 'Elegí al menos un jugador válido para la oferta.');
  }
  const sorted = [...to].sort((a, b) => a - b);
  s.trade = { from: player, give, get, responses: sorted.map((p) => ({ player: p, status: 'pending' })) };
  s.tradeOffers = (s.tradeOffers ?? 0) + 1;
  events.push({ type: 'TradeProposed', player, give, get, to: sorted });
  return null;
}

export function respondTrade(s: GameState, player: PlayerId, accept: boolean, events: GameEvent[]): Err {
  const offer = s.trade;
  if (!offer) return bad('no-trade', 'No hay ninguna oferta abierta.');
  const mine = offer.responses.find((r) => r.player === player);
  if (!mine) return bad('invalid-target', 'Esta oferta no es para vos.');
  if (mine.status !== 'pending') return bad('invalid-trade', 'Ya respondiste esta oferta.');
  if (accept && !has(s.players[player].hand, offer.get)) return bad('insufficient-resources', 'No tenés las cartas que te piden.');
  mine.status = accept ? 'accepted' : 'rejected';
  events.push({ type: 'TradeResponded', player, accept });
  // si ya respondieron todos y nadie aceptó, la oferta se cierra sola (quien propuso no queda esperando)
  if (offer.responses.every((r) => r.status === 'rejected')) {
    s.trade = null;
    events.push({ type: 'TradeCancelled', player: offer.from, reason: 'rejected' });
  }
  return null;
}

export function confirmTrade(s: GameState, player: PlayerId, other: PlayerId, events: GameEvent[]): Err {
  const offer = s.trade;
  if (!offer) return bad('no-trade', 'No hay ninguna oferta abierta.');
  if (offer.from !== player) return bad('not-your-turn', 'Solo quien propuso puede concretar el cambio.');
  if (offer.responses.find((r) => r.player === other)?.status !== 'accepted') return bad('invalid-target', 'Ese jugador no aceptó la oferta.');
  const a = s.players[player].hand;
  const b = s.players[other].hand;
  if (!has(a, offer.give) || !has(b, offer.get)) return bad('insufficient-resources', 'Alguno ya no tiene las cartas del cambio.');
  for (const r of RESOURCES) {
    const g = offer.give[r] ?? 0;
    const t = offer.get[r] ?? 0;
    a[r] += t - g;
    b[r] += g - t;
  }
  s.trade = null;
  events.push({ type: 'TradeCompleted', player, with: other, give: offer.give, get: offer.get });
  return null;
}

export function cancelTrade(s: GameState, player: PlayerId, events: GameEvent[]): Err {
  const offer = s.trade;
  if (!offer) return bad('no-trade', 'No hay ninguna oferta abierta.');
  if (offer.from !== player) return bad('not-your-turn', 'Solo quien propuso puede cancelar la oferta.');
  s.trade = null;
  events.push({ type: 'TradeCancelled', player, reason: 'cancelled' });
  return null;
}

/** Acciones de comercio entre jugadores para `player`: proponer (de turno, sin oferta abierta), responder (consultado) o concretar/cancelar (proponente). */
export function tradeActions(s: GameState, player: PlayerId): LegalAction[] {
  const offer: TradeOffer | null = s.trade ?? null;
  if (s.phase.kind !== 'main') return [];
  if (!offer) {
    const rich = RESOURCES.some((r) => s.players[player].hand[r] > 0);
    return player === s.turn && rich && offersLeft(s) > 0 ? [{ type: 'proposeTrade', left: offersLeft(s) }] : [];
  }
  if (offer.from === player) {
    const accepted = offer.responses.filter((r) => r.status === 'accepted').map((r) => r.player);
    return [...(accepted.length ? [{ type: 'confirmTrade' as const, with: accepted }] : []), { type: 'cancelTrade' }];
  }
  const mine = offer.responses.find((r) => r.player === player);
  return mine?.status === 'pending' ? [{ type: 'respondTrade', canAccept: has(s.players[player].hand, offer.get) }] : [];
}
