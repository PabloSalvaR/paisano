// Hace jugar a los bots: mientras le toque a un asiento de bot, elige un comando entre sus acciones legales y lo aplica.
// Es puro (sin red ni base de datos) para que lo usen igual la sala del servidor y la partida local del navegador.

import { applyCommand, legalActions } from '../engine';
import type { GameEvent, GameState, PlayerId, Rng } from '../engine';
import type { Bot } from './random';
import { smartBot } from './smart';

const MAX_STEPS = 2000; // tope de jugadas seguidas (una partida entera cabe de sobra)

/**
 * Quién actúa ahora entre los bots, o null si toca esperar a una persona (o no queda nada por hacer).
 * Con una oferta de comercio abierta: primero responden los bots consultados; si falta una persona, se espera; y cuando ya
 * respondieron todos, concreta quien propuso (si es un bot).
 */
export function nextBot(s: GameState, isBot: (player: PlayerId) => boolean): PlayerId | null {
  if (s.phase.kind === 'finished') return null;
  if (s.trade) {
    const pending = s.trade.responses.filter((r) => r.status === 'pending').map((r) => r.player);
    const bot = pending.find(isBot);
    if (bot !== undefined) return bot;
    if (pending.length) return null;
    return isBot(s.trade.from) ? s.trade.from : null;
  }
  return isBot(s.turn) ? s.turn : null;
}

/**
 * Juega por los bots hasta que le toque a un humano o termine la partida. Devuelve el estado nuevo y los eventos en orden.
 * Un bot que se equivoca corta la tanda sin trabar nada: el estado devuelto es siempre válido.
 */
export function playBots(state: GameState, isBot: (player: PlayerId) => boolean, rng: Rng, bot: Bot | Bot[] = smartBot): { state: GameState; events: GameEvent[] } {
  const botOf = (p: PlayerId): Bot => (Array.isArray(bot) ? bot[p] ?? smartBot : bot); // un bot para todos, o uno por asiento (perfiles)
  const events: GameEvent[] = [];
  let s = state;
  for (let i = 0, me = nextBot(s, isBot); i < MAX_STEPS && me !== null; i++, me = nextBot(s, isBot)) {
    const legal = legalActions(s, me);
    if (!legal.length) break;
    const result = applyCommand(s, botOf(me)({ me, legal, hand: s.players[me].hand, state: s }, rng));
    if (!result.ok) break;
    s = result.state;
    events.push(...result.events);
  }
  return { state: s, events };
}
