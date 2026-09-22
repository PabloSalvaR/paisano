// Bot con criterio: sigue la misma interfaz que el aleatorio (elige entre las acciones legales) pero puntúa las opciones.
// Pone las casas donde más se produce y con recursos variados, sube estancias antes que nada, cambia con el banco solo para
// completar una compra, mueve el ladrón contra el que va ganando y descarta lo que más le sobra.
// No es un jugador experto: la idea es que una partida contra bots tenga algo de pelea.

import { RESOURCES, canAfford, canSettleAt, handTotal, publicVictoryPoints, topology } from '../engine';
import type { Command, Cost, GameState, Hand, LegalAction, PlayerId, Resource, Rng } from '../engine';
import { commandFor, randomBot, type Bot, type BotInput } from './random';

/** Puntos de probabilidad de una ficha (los «puntitos» del tablero): 6 y 8 valen 5; 2 y 12 valen 1. */
export const pips = (n: number): number => (n ? 6 - Math.abs(7 - n) : 0);

/** Recursos que ya produce este jugador con sus casas y estancias. */
function produced(s: GameState, me: PlayerId): Set<Resource> {
  const topo = topology();
  const out = new Set<Resource>();
  s.vertexBuildings.forEach((b, v) => {
    if (b?.player !== me) return;
    for (const t of topo.vertices[v].tiles) {
      const terrain = s.map.terrains[t];
      if (terrain !== 'desert' && s.map.numbers[t]) out.add(terrain);
    }
  });
  return out;
}

/** Cuánto vale un vértice para construir ahí: probabilidad de producir, variedad (sobre todo lo que aún no produce) y puerto. */
export function vertexValue(s: GameState, v: number, mine: Set<Resource>): number {
  const topo = topology();
  let value = 0;
  const seen = new Set<Resource>();
  for (const t of topo.vertices[v].tiles) {
    const terrain = s.map.terrains[t];
    if (terrain === 'desert') continue;
    value += pips(s.map.numbers[t]) * (mine.has(terrain) ? 0.8 : 1.15);
    seen.add(terrain);
  }
  value += seen.size * 0.6;
  const port = s.map.ports.find((pt) => pt.vertices.includes(v));
  if (port) value += port.resource === null ? 1 : seen.has(port.resource) ? 1.5 : 0.4;
  return value;
}

/** Cuánto vale un camino: lo bueno que es el lugar donde dejaría construir (el extremo libre y, algo menos, sus vecinos). */
function roadValue(s: GameState, edge: number, me: PlayerId, mine: Set<Resource>): number {
  const topo = topology();
  const e = topo.edges[edge];
  let best = 0;
  for (const v of [e.a, e.b]) {
    if (s.vertexBuildings[v]) continue; // el extremo «de avanzada» es el que no tiene edificio
    if (canSettleAt(s, v)) best = Math.max(best, vertexValue(s, v, mine));
    else for (const n of topo.vertices[v].neighbors) if (canSettleAt(s, n)) best = Math.max(best, vertexValue(s, n, mine) * 0.5);
  }
  return best;
}

/** Cuánto conviene poner el ladrón en una casilla: le pega a los rivales (más si van ganando) y nunca a uno mismo. */
function tileHarm(s: GameState, tile: number, me: PlayerId): number {
  const p = pips(s.map.numbers[tile]);
  let harm = 0;
  for (const v of topology().tiles[tile].vertices) {
    const b = s.vertexBuildings[v];
    if (!b) continue;
    const weight = (b.city ? 2 : 1) * p;
    harm += b.player === me ? -3 * weight : weight * (1 + publicVictoryPoints(s, b.player) / 5);
  }
  return harm;
}

/** Lo que falta de cada recurso para pagar `cost`. */
const missingFor = (hand: Hand, cost: Cost): Resource[] => RESOURCES.filter((r) => (cost[r] ?? 0) > hand[r]);

/** Mayor por puntaje; entre iguales gana el azar (un desempate chico para que no jueguen todos igual). */
function best<T>(xs: readonly T[], score: (x: T) => number, rng: Rng): T {
  let top = xs[0];
  let topScore = -Infinity;
  for (const x of xs) {
    const sc = score(x) + rng() * 0.01;
    if (sc > topScore) {
      topScore = sc;
      top = x;
    }
  }
  return top;
}

/** Las compras que le interesan, de más a menos valiosa: estancia (si tiene una casa para subir), casa y carta de desarrollo. */
function goalsFor(s: GameState, me: PlayerId): Cost[] {
  const { costs, maxPieces } = s.config;
  let settlements = 0;
  let cities = 0;
  for (const b of s.vertexBuildings) {
    if (b?.player !== me) continue;
    if (b.city) cities++;
    else settlements++;
  }
  const goals: Cost[] = [];
  if (cities < maxPieces.cities && settlements > 0) goals.push(costs.city);
  if (settlements < maxPieces.settlements) goals.push(costs.settlement);
  goals.push(costs.developmentCard);
  return goals;
}

/** Cuántas cartas le faltan a esta mano para su compra más cercana. */
function distance(hand: Hand, goals: Cost[]): number {
  return Math.min(...goals.map((g) => RESOURCES.reduce((n, r) => n + Math.max(0, (g[r] ?? 0) - hand[r]), 0)));
}

const BOT_MAX_OFFERS = 2; // el bot no insiste más que esto por turno (el tope de las reglas es mayor)

/** Acepta si el cambio lo acerca a una compra (o, a igual distancia, recibe más cartas de las que da) y quien propone no está por ganar. */
function answerTrade(s: GameState, me: PlayerId, hand: Hand, a: Extract<LegalAction, { type: 'respondTrade' }>): boolean {
  const offer = s.trade;
  if (!offer || !a.canAccept) return false;
  if (publicVictoryPoints(s, offer.from) >= s.config.victoryPoints - 2) return false; // no ayuda al que está por ganar
  const after = { ...hand };
  let gets = 0;
  let gives = 0;
  for (const r of RESOURCES) {
    after[r] += (offer.give[r] ?? 0) - (offer.get[r] ?? 0);
    gets += offer.give[r] ?? 0;
    gives += offer.get[r] ?? 0;
  }
  const goals = goalsFor(s, me);
  const before = distance(hand, goals);
  const now = distance(after, goals);
  return now < before || (now === before && gets > gives);
}

/**
 * Propone 1 carta que le sobra por 1 que le falta, cuando está a 1 o 2 cartas de una compra. Arma todas las ofertas
 * distintas que tiene sentido probar (cada recurso sobrante, y si con 1 no alcanzaría a nadie también con 2) y usa
 * `tradeOffers` como índice: así cada intento del turno es una oferta distinta y, si ya probó todas, no insiste más.
 */
function proposeCommand(s: GameState, me: PlayerId, hand: Hand): Command | null {
  const k = s.tradeOffers ?? 0;
  if (k >= BOT_MAX_OFFERS) return null;
  const seen = new Set<string>(); // dos objetivos distintos (casa, carta...) pueden terminar pidiendo lo mismo: no la repite
  const candidates: Command[] = [];
  const add = (give: Resource, amount: number, get: Resource) => {
    const key = give + amount + get;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ type: 'proposeTrade', player: me, give: { [give]: amount }, get: { [get]: 1 } });
  };
  for (const goal of goalsFor(s, me)) {
    const missing = missingFor(hand, goal);
    const short = missing.reduce((n, r) => n + (goal[r] ?? 0) - hand[r], 0);
    if (!missing.length || short > 2) continue;
    const spare = RESOURCES.filter((r) => hand[r] - (goal[r] ?? 0) >= 1 && !missing.includes(r)).sort((a, b) => hand[b] - (goal[b] ?? 0) - (hand[a] - (goal[a] ?? 0)));
    for (const give of spare) add(give, 1, missing[0]);
    for (const give of spare) {
      const amount = Math.min(2, hand[give] - (goal[give] ?? 0));
      if (amount > 1) add(give, amount, missing[0]); // si 1 por 1 no alcanzaría, prueba con 2
    }
  }
  return candidates[k] ?? null;
}

/** Comercia con el banco solo si con ese único cambio queda pagable una construcción (estancia, casa o carta). */
function tradeForGoal(s: GameState, me: PlayerId, hand: Hand, a: Extract<LegalAction, { type: 'bankTrade' }>): Command | null {
  const goals = goalsFor(s, me);
  for (const goal of goals) {
    const missing = missingFor(hand, goal);
    if (missing.length !== 1 || (goal[missing[0]] ?? 0) - hand[missing[0]] !== 1) continue; // solo si UN cambio la completa
    for (const t of a.trades) {
      if (t.give !== missing[0] && t.get.includes(missing[0]) && hand[t.give] - (goal[t.give] ?? 0) >= t.rate) {
        return { type: 'bankTrade', player: me, give: t.give, get: missing[0] };
      }
    }
  }
  return null;
}

/** Descarta primero lo que más tiene (así conserva variedad para construir). */
function discardCommand(me: PlayerId, hand: Hand, count: number): Command {
  const left = { ...hand };
  const cards: Partial<Hand> = {};
  for (let i = 0; i < count; i++) {
    const r = RESOURCES.reduce((a, b) => (left[b] > left[a] ? b : a));
    left[r]--;
    cards[r] = (cards[r] ?? 0) + 1;
  }
  return { type: 'discard', player: me, cards };
}

export const smartBot: Bot = (input: BotInput, rng: Rng): Command => {
  const { me, legal, hand, state: s } = input;
  if (!s) return randomBot(input, rng); // sin el estado completo no puede juzgar: cae al aleatorio
  const has = <T extends LegalAction['type']>(type: T) => legal.find((a): a is Extract<LegalAction, { type: T }> => a.type === type);
  const mine = produced(s, me);
  const bestVertex = (vs: number[]) => best(vs, (v) => vertexValue(s, v, mine), rng);

  // comercio con jugadores: responder (fuera de turno también) y, si propuse yo, concretar con el que aceptó y menos puntos tiene
  const rt = has('respondTrade');
  if (rt) return { type: 'respondTrade', player: me, accept: answerTrade(s, me, hand, rt) };
  const ct = has('confirmTrade');
  if (ct) return { type: 'confirmTrade', player: me, with: best(ct.with, (p) => -publicVictoryPoints(s, p), rng) };
  if (has('cancelTrade')) return { type: 'cancelTrade', player: me };

  // colocación inicial
  const ps = has('placeSettlement');
  if (ps) return { type: 'placeSettlement', player: me, vertex: bestVertex(ps.vertices) };
  const pr = has('placeRoad');
  if (pr) return { type: 'placeRoad', player: me, edge: best(pr.edges, (e) => roadValue(s, e, me, mine), rng) };

  // descarte, ladrón y robo
  const dis = has('discard');
  if (dis) return discardCommand(me, hand, dis.count);
  const mr = has('moveRobber');
  if (mr) return { type: 'moveRobber', player: me, tile: best(mr.tiles, (t) => tileHarm(s, t, me), rng) };
  const st = has('steal');
  if (st) return { type: 'steal', player: me, victim: best(st.victims, (v) => publicVictoryPoints(s, v) * 10 + handTotal(s.players[v].hand), rng) };

  // antes de tirar: el gaucho si el ladrón está sobre una casilla mía (todo lo demás espera a la tirada)
  const knight = has('playKnight');
  const robbed = !!s.map.numbers[s.robber] && topology().tiles[s.robber].vertices.some((v) => s.vertexBuildings[v]?.player === me);
  if (knight && robbed) return { type: 'playKnight', player: me };
  if (has('rollDice')) return { type: 'rollDice', player: me };
  if (has('playRoadBuilding')) return { type: 'playRoadBuilding', player: me };

  // construir, en orden de rendimiento: estancia, casa, carta, camino
  const city = has('buildCity');
  if (city) return { type: 'buildCity', player: me, vertex: bestVertex(city.vertices) };
  const settle = has('buildSettlement');
  if (settle) return { type: 'buildSettlement', player: me, vertex: bestVertex(settle.vertices) };
  if (has('buyDevCard')) return { type: 'buyDevCard', player: me };
  const road = has('buildRoad');
  if (road) {
    const e = best(road.edges, (x) => roadValue(s, x, me, mine), rng);
    if (roadValue(s, e, me, mine) > 0) return { type: 'buildRoad', player: me, edge: e };
  }

  // cartas de progreso: pedir o quitar lo que falta para la próxima construcción
  const goal = s.vertexBuildings.some((b) => b?.player === me && !b.city) ? s.config.costs.city : s.config.costs.settlement;
  const missing = missingFor(hand, goal);
  const yop = has('playYearOfPlenty');
  if (yop) {
    const wanted = missing.filter((r) => yop.resources.includes(r));
    const pool = wanted.length ? wanted : yop.resources;
    return { type: 'playYearOfPlenty', player: me, resources: Array.from({ length: yop.count }, (_, i) => pool[i % pool.length]) };
  }
  if (has('playMonopoly')) return { type: 'playMonopoly', player: me, resource: missing.length ? best(missing, () => 0, rng) : best([...RESOURCES], (r) => -hand[r], rng) };
  if (knight && !canAfford(hand, goal)) return { type: 'playKnight', player: me };

  // comerciar solo si completa una compra
  const bt = has('bankTrade');
  if (bt) {
    const trade = tradeForGoal(s, me, hand, bt);
    if (trade) return trade;
  }

  // si le falta poco para una compra, ofrece un cambio a los demás
  if (has('proposeTrade')) {
    const offer = proposeCommand(s, me, hand);
    if (offer) return offer;
  }

  if (has('endTurn')) return { type: 'endTurn', player: me };
  return commandFor(legal[0], me, hand, rng);
};
