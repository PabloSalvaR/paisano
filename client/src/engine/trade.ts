// Comercio con el banco: 4:1 por defecto, 3:1 con un puerto genérico y 2:1 con el puerto específico del recurso.

import { bad, type Err } from './helpers';
import { RESOURCES, type Resource } from './map';
import type { GameEvent, GameState, PlayerId } from './types';

/** Cuántas cartas iguales hay que entregar por 1 del banco: la mejor tasa que le dan al jugador sus casas y estancias. */
export function tradeRate(s: GameState, player: PlayerId, resource: Resource): number {
  const { bank, genericPort, specificPort } = s.config.trade;
  let rate = bank;
  for (const port of s.map.ports) {
    if (!port.vertices.some((v) => s.vertexBuildings[v]?.player === player)) continue;
    if (port.resource === null) rate = Math.min(rate, genericPort);
    else if (port.resource === resource) rate = Math.min(rate, specificPort);
  }
  return rate;
}

/** Lo que el jugador puede entregar (con su tasa) y lo que puede pedir a cambio (el banco tiene que tener la carta). */
export function bankTradeOptions(s: GameState, player: PlayerId): { give: Resource; rate: number; get: Resource[] }[] {
  if (s.phase.kind !== 'main') return [];
  return RESOURCES.flatMap((give) => {
    const rate = tradeRate(s, player, give);
    if (s.players[player].hand[give] < rate) return [];
    const get = RESOURCES.filter((r) => r !== give && s.bank[r] > 0);
    return get.length ? [{ give, rate, get }] : [];
  });
}

export function bankTrade(s: GameState, player: PlayerId, give: Resource, get: Resource, events: GameEvent[]): Err {
  if (s.phase.kind !== 'main') return bad('wrong-phase', 'Solo se puede comerciar después de tirar los dados.');
  if (!RESOURCES.includes(give) || !RESOURCES.includes(get)) return bad('invalid-trade', 'Ese recurso no existe.');
  if (give === get) return bad('invalid-trade', 'Tenés que pedir un recurso distinto del que entregás.');
  const rate = tradeRate(s, player, give);
  const hand = s.players[player].hand;
  if (hand[give] < rate) return bad('insufficient-resources', `Para cambiar ese recurso necesitás ${rate} iguales.`);
  if (s.bank[get] < 1) return bad('bank-empty', 'El banco no tiene de ese recurso.');
  hand[give] -= rate;
  s.bank[give] += rate;
  s.bank[get] -= 1;
  hand[get] += 1;
  events.push({ type: 'BankTraded', player, give, giveCount: rate, get });
  return null;
}
