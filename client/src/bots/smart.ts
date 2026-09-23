// Bot con criterio: sigue la misma interfaz que el aleatorio (elige entre las acciones legales) pero puntúa las opciones.
// Pone las casas donde más se produce y con recursos variados, sube estancias antes que nada, cambia con el banco solo para
// completar una compra, mueve el ladrón contra el que va ganando y descarta lo que más le sobra.
// No es un jugador experto: la idea es que una partida contra bots tenga algo de pelea.

import { RESOURCES, canAfford, canSettleAt, handTotal, longestRoad, publicVictoryPoints, topology } from '../engine';
import type { Command, Cost, GameState, Hand, LegalAction, PlayerId, Resource, Rng } from '../engine';
import { robberVictims } from '../engine/robber';
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

/** Si el vértice ya es parte de la red del jugador (tiene un edificio suyo o lo toca un camino suyo). */
function onNetwork(s: GameState, v: number, me: PlayerId): boolean {
  return s.vertexBuildings[v]?.player === me || topology().vertices[v].edges.some((e) => s.edgeRoads[e] === me);
}

/** Si ya tiene un lugar libre para una casa al que llega con sus caminos (entonces conviene guardar para la casa). */
function hasReachableSpot(s: GameState, me: PlayerId): boolean {
  return topology().vertices.some((v) => canSettleAt(s, v.id) && v.edges.some((e) => s.edgeRoads[e] === me));
}

/**
 * Puntuador de caminos. Suma dos cosas:
 * - `spot`: lo bueno que es el lugar para una casa al que lleva (el extremo nuevo y, algo menos, sus vecinos).
 * - `stretch`: cuánto alarga su ruta continua más larga, más un poco si el extremo nuevo queda abierto para seguir. Así
 *   prefiere estirar la punta de la ruta hacia afuera, que es lo que suma para la Ruta más larga.
 * Un camino con los dos extremos ya en su red (cierra un anillo o rellena un hueco) y que no alarga la ruta vale 0: antes, sin
 * un lugar para casa a la vista, todos valían lo mismo y el bot terminaba dando vueltas en círculo alrededor de sus casas.
 */
function roadScorer(s: GameState, me: PlayerId, mine: Set<Resource>) {
  const topo = topology();
  const base = longestRoad(s, me);
  // si otro ya tiene una ruta mucho más larga, pelear el reconocimiento no vale la pena: estirar pesa menos
  const rival = Math.max(0, ...s.players.map((_, p) => (p === me ? 0 : longestRoad(s, p))));
  const stretchWeight = rival - base > 3 ? 0.5 : 2;
  const parts = (edge: number) => {
    const e = topo.edges[edge];
    const fresh = [e.a, e.b].filter((v) => !onNetwork(s, v, me)); // el extremo «de avanzada»: el que todavía no es de su red
    let spot = 0;
    for (const v of fresh) {
      if (canSettleAt(s, v)) spot = Math.max(spot, vertexValue(s, v, mine));
      else if (!s.vertexBuildings[v]) for (const n of topo.vertices[v].neighbors) if (canSettleAt(s, n)) spot = Math.max(spot, vertexValue(s, n, mine) * 0.5);
    }
    const edgeRoads = s.edgeRoads.slice();
    edgeRoads[edge] = me;
    const gain = longestRoad({ ...s, edgeRoads }, me) - base;
    if (!fresh.length && gain <= 0) return { spot: 0, stretch: 0 }; // anillo o relleno: no suma nada
    // extremo abierto: caminos libres para seguir desde ahí, sin una casa rival que corte
    let open = 0;
    for (const v of fresh) {
      const b = s.vertexBuildings[v];
      if (b && b.player !== me) continue;
      open += topo.vertices[v].edges.filter((x) => x !== edge && s.edgeRoads[x] === null).length;
    }
    return { spot, stretch: gain > 0 ? gain * stretchWeight + open * 0.3 : 0 };
  };
  return {
    parts,
    value: (edge: number) => {
      const p = parts(edge);
      return p.spot + p.stretch;
    },
  };
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

/** Las compras que le interesan, de más a menos valiosa: estancia (si tiene una casa para subir), casa y carta de desarrollo (salvo que esté juntando para las otras). */
function goalsFor(s: GameState, me: PlayerId, hand: Hand): Cost[] {
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
  if (!savingForBuilding(s, me, hand)) goals.push(costs.developmentCard); // si está juntando, no comercia para la carta
  return goals;
}

const SAVE_WITHIN = 2; // si a la estancia o a la casa le faltan hasta estas cartas, junta para ella en vez de comprar una carta
const SAVE_MAX_HAND = 7; // con más cartas que esto gasta igual: con un 7 perdería la mitad

/** Las construcciones para las que tiene sentido juntar: estancia (si tiene una casa para subir) y casa (si ya llega a un lugar libre). */
function buildingTargets(s: GameState, me: PlayerId): Cost[] {
  const { costs, maxPieces } = s.config;
  let settlements = 0;
  let cities = 0;
  for (const b of s.vertexBuildings) {
    if (b?.player !== me) continue;
    if (b.city) cities++;
    else settlements++;
  }
  const targets: Cost[] = [];
  if (cities < maxPieces.cities && settlements > 0) targets.push(costs.city);
  if (settlements < maxPieces.settlements && hasReachableSpot(s, me)) targets.push(costs.settlement);
  return targets;
}

/**
 * Si conviene guardar en vez de comprar una carta de desarrollo: la carta usa vaca, maíz y piedra, lo mismo que piden la
 * estancia y la casa, así que comprarla apenas alcanzaba le comía lo que venía juntando. Guarda si le faltan pocas cartas
 * para una de las dos y la carta lo alejaría de ella, salvo con la mano llena (con un 7 perdería la mitad).
 */
function savingForBuilding(s: GameState, me: PlayerId, hand: Hand): boolean {
  if (handTotal(hand) > SAVE_MAX_HAND) return false;
  const after = { ...hand };
  for (const r of RESOURCES) after[r] -= s.config.costs.developmentCard[r] ?? 0;
  return buildingTargets(s, me).some((goal) => {
    const d = distance(hand, [goal]);
    return d <= SAVE_WITHIN && distance(after, [goal]) > d;
  });
}

/** Cuántas cartas le faltan a esta mano para su compra más cercana. */
function distance(hand: Hand, goals: Cost[]): number {
  return Math.min(...goals.map((g) => RESOURCES.reduce((n, r) => n + Math.max(0, (g[r] ?? 0) - hand[r]), 0)));
}

const BOT_MAX_OFFERS = 2; // el bot no insiste más que esto por turno (el tope de las reglas es mayor)

/**
 * Qué tan avanzada va la partida, de 0 a 1, según los puntos públicos del que va primero: 0 hasta el 40 % de los puntos para
 * ganar (4 de 10) y 1 cuando está a un punto de ganar (9 de 10). Con esto los bots comercian mucho al principio y casi nada al final.
 */
export function lateness(s: GameState): number {
  const top = Math.max(...s.players.map((_, p) => publicVictoryPoints(s, p)));
  const start = s.config.victoryPoints * 0.4;
  const end = s.config.victoryPoints - 1;
  return Math.min(1, Math.max(0, (top - start) / Math.max(1, end - start)));
}

/** Si `p` va primero en puntos públicos y por delante de `me` (a ese no se le quiere dar cartas cuando la partida avanza). */
function isLeader(s: GameState, p: PlayerId, me: PlayerId): boolean {
  const vp = publicVictoryPoints(s, p);
  return vp > publicVictoryPoints(s, me) && s.players.every((_, q) => publicVictoryPoints(s, q) <= vp);
}

/**
 * Acepta si el cambio lo acerca a una compra (o, a igual distancia, recibe más cartas de las que da) y quien propone no está
 * por ganar. A medida que avanza la partida rechaza más por las dudas (con probabilidad `lateness`), y el doble si quien
 * ofrece es el que va ganando.
 */
function answerTrade(s: GameState, me: PlayerId, hand: Hand, a: Extract<LegalAction, { type: 'respondTrade' }>, rng: Rng): boolean {
  const offer = s.trade;
  if (!offer || !a.canAccept) return false;
  if (publicVictoryPoints(s, offer.from) >= s.config.victoryPoints - 2) return false; // no ayuda al que está por ganar
  const late = lateness(s);
  if (late > 0 && rng() < late * (isLeader(s, offer.from, me) ? 2 : 1)) return false;
  const after = { ...hand };
  let gets = 0;
  let gives = 0;
  for (const r of RESOURCES) {
    after[r] += (offer.give[r] ?? 0) - (offer.get[r] ?? 0);
    gets += offer.give[r] ?? 0;
    gives += offer.get[r] ?? 0;
  }
  const goals = goalsFor(s, me, hand);
  const before = distance(hand, goals);
  const now = distance(after, goals);
  return now < before || (now === before && gets > gives);
}

/** Probabilidad de arriesgar una oferta en un turno, según cuánto le falte para la compra más cercana: casi seguro si es una sola carta, más dudoso con dos. */
const TRADE_EAGERNESS: Record<1 | 2, number> = { 1: 0.65, 2: 0.35 }; // al principio; después se multiplica por (1 − lateness)²

/**
 * Propone 1 carta que le sobra por 1 que le falta, cuando está a 1 o 2 cartas de una compra. No ofrece todos los turnos:
 * antes de tradear, en la vida real uno prefiere ir juntando por su cuenta (con un 7 puede perder de más, o el ladrón le
 * puede robar justo lo que dio), así que el primer intento del turno se arriesga solo con una probabilidad
 * (`TRADE_EAGERNESS`, más alta cuanto más cerca está de completar la compra); si ya ofreció este turno, sigue insistiendo
 * sin volver a tirar la moneda. Arma todas las ofertas distintas que tiene sentido probar (cada recurso sobrante, y si con
 * 1 no alcanzaría a nadie también con 2) y usa `tradeOffers` como índice: así cada intento del turno es una oferta
 * distinta y, si ya probó todas, no insiste más.
 */
function proposeCommand(s: GameState, me: PlayerId, hand: Hand, rng: Rng): Command | null {
  const k = s.tradeOffers ?? 0;
  if (k >= BOT_MAX_OFFERS) return null;
  const shortest = Math.min(...goalsFor(s, me, hand).map((goal) => {
    const missing = missingFor(hand, goal);
    return missing.length ? missing.reduce((n, r) => n + (goal[r] ?? 0) - hand[r], 0) : Infinity;
  }));
  if (shortest > 2) return null;
  // paciencia: no siempre arriesga el primer intento, y cuanto más avanzada la partida menos ganas (desde que alguien tiene 8 de 10, nada)
  const late = lateness(s);
  if (late >= 0.8) return null;
  if (k === 0 && rng() > TRADE_EAGERNESS[shortest as 1 | 2] * (1 - late) ** 2) return null;
  // ya avanzada la partida, no le ofrece al que va ganando
  const to = late > 0 ? s.players.map((_, p) => p).filter((p) => p !== me && !isLeader(s, p, me)) : undefined;
  if (to && !to.length) return null;
  const seen = new Set<string>(); // dos objetivos distintos (casa, carta...) pueden terminar pidiendo lo mismo: no la repite
  const candidates: Command[] = [];
  const add = (give: Resource, amount: number, get: Resource) => {
    const key = give + amount + get;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ type: 'proposeTrade', player: me, give: { [give]: amount }, get: { [get]: 1 }, ...(to ? { to } : {}) });
  };
  for (const goal of goalsFor(s, me, hand)) {
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
  const goals = goalsFor(s, me, hand);
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

/**
 * Cambios con el banco en varios pasos para subir una estancia o poner una casa (con un lugar al que ya llega): si con lo que
 * le sobra alcanza para todos los cambios que faltan, hace el primero (entrega lo que más le sobra); en las jugadas
 * siguientes sigue. Sin esto, con la mano llena no sabía en qué gastar y compraba cartas de desarrollo (13 de cada 18 compras
 * eran con más de 7 cartas) y el mazo se agotaba en el 70 % de las partidas.
 */
function tradeTowardBuilding(s: GameState, me: PlayerId, hand: Hand, a: Extract<LegalAction, { type: 'bankTrade' }>): Command | null {
  const targets = buildingTargets(s, me);
  for (const goal of targets) {
    const missing = missingFor(hand, goal);
    if (!missing.length) continue;
    const short = missing.reduce((n, r) => n + (goal[r] ?? 0) - hand[r], 0);
    const rate = (r: Resource) => a.trades.find((t) => t.give === r)?.rate ?? Infinity;
    const spare = RESOURCES.filter((r) => !missing.includes(r) && hand[r] - (goal[r] ?? 0) >= rate(r));
    const capacity = spare.reduce((n, r) => n + Math.floor((hand[r] - (goal[r] ?? 0)) / rate(r)), 0);
    if (capacity < short) continue;
    const give = spare.reduce((x, y) => (hand[y] - (goal[y] ?? 0) > hand[x] - (goal[x] ?? 0) ? y : x));
    const get = missing[0];
    if (a.trades.some((t) => t.give === give && t.get.includes(get))) return { type: 'bankTrade', player: me, give, get };
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
  if (rt) return { type: 'respondTrade', player: me, accept: answerTrade(s, me, hand, rt, rng) };
  const ct = has('confirmTrade');
  if (ct) return { type: 'confirmTrade', player: me, with: best(ct.with, (p) => -publicVictoryPoints(s, p), rng) };
  if (has('cancelTrade')) return { type: 'cancelTrade', player: me };

  // colocación inicial
  const ps = has('placeSettlement');
  if (ps) return { type: 'placeSettlement', player: me, vertex: bestVertex(ps.vertices) };
  const pr = has('placeRoad');
  if (pr) {
    const roads = roadScorer(s, me, mine);
    return { type: 'placeRoad', player: me, edge: best(pr.edges, roads.value, rng) };
  }

  // descarte, ladrón y robo
  const dis = has('discard');
  if (dis) return discardCommand(me, hand, dis.count);
  const mr = has('moveRobber');
  if (mr) {
    // primero las casillas donde hay a quién robarle (un rival con cartas): tapar al que va ganando sin sacarle nada vale menos
    const robbable = mr.tiles.filter((t) => tileHarm(s, t, me) > 0 && robberVictims(s, me, t).length > 0);
    return { type: 'moveRobber', player: me, tile: best(robbable.length ? robbable : mr.tiles, (t) => tileHarm(s, t, me), rng) };
  }
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
  const btb = has('bankTrade');
  if (btb) {
    const trade = tradeTowardBuilding(s, me, hand, btb);
    if (trade) return trade;
  }
  if (has('buyDevCard') && !savingForBuilding(s, me, hand)) return { type: 'buyDevCard', player: me };
  const road = has('buildRoad');
  if (road) {
    // si ya llega a un lugar para una casa, guarda madera y ladrillo para ella: solo gasta en un camino que abra otro lugar
    const roads = roadScorer(s, me, mine);
    const saving = hasReachableSpot(s, me);
    const worth = (x: number) => {
      const p = roads.parts(x);
      return saving ? p.spot : p.spot + p.stretch;
    };
    const e = best(road.edges, worth, rng);
    if (worth(e) > 0) return { type: 'buildRoad', player: me, edge: e };
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
    const offer = proposeCommand(s, me, hand, rng);
    if (offer) return offer;
  }

  if (has('endTurn')) return { type: 'endTurn', player: me };
  return commandFor(legal[0], me, hand, rng);
};
