// Hace jugar a los bots: mientras le toque a un asiento de bot, elige un comando entre sus acciones legales y lo aplica.
// Es puro (sin red ni base de datos) para que lo usen igual la sala del servidor y la partida local del navegador.

import { applyCommand, legalActions } from '../engine';
import type { GameEvent, GameState, PlayerId, Rng } from '../engine';
import { randomBot, type Bot } from './random';

const MAX_STEPS = 2000; // tope de jugadas seguidas (una partida entera cabe de sobra)

/**
 * Juega por los bots hasta que le toque a un humano o termine la partida. Devuelve el estado nuevo y los eventos en orden.
 * Un bot que se equivoca corta la tanda sin trabar nada: el estado devuelto es siempre válido.
 */
export function playBots(state: GameState, isBot: (player: PlayerId) => boolean, rng: Rng, bot: Bot = randomBot): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = state;
  for (let i = 0; i < MAX_STEPS && s.phase.kind !== 'finished' && isBot(s.turn); i++) {
    const me = s.turn;
    const legal = legalActions(s, me);
    if (!legal.length) break;
    const result = applyCommand(s, bot({ me, legal, hand: s.players[me].hand }, rng));
    if (!result.ok) break;
    s = result.state;
    events.push(...result.events);
  }
  return { state: s, events };
}
