// Perfil según el tablero: en vez de sortearlo, cada bot elige el suyo al poner su segunda casa, mirando lo que le dio la
// primera y lo que quedó libre (si le sacaron la buena piedra y el buen maíz, no va a ser estanciero). La primera la pone como
// balanceado: en ese momento el mapa está casi vacío y no dice nada (se midió: elegir ahí daba casi siempre los especialistas,
// o lo mismo que sortear). Los perfiles no se repiten: cada bot elige entre los que todavía no tomó otro. Es lógica de los
// bots, no una regla: el motor no se entera.

import { topology } from '../engine';
import type { GameState, PlayerId, Resource, Rng } from '../engine';
import { PROFILES, type BotProfileId } from './profiles';
import type { Bot } from './random';
import { makeSmartBot, vertexValue } from './smart';

const NONE = new Set<Resource>();
const BALANCED_BOT = makeSmartBot(PROFILES.balanced);
const SPECIALIST_FIT = 0.8; // un especialista se elige si su primera casa y lo libre le dan al menos esto de lo mejor del mapa para él

/** Lo que un lugar le da a un especialista: los puntitos de las casillas de los recursos que prefiere (peso mayor que 1). */
function specialty(s: GameState, v: number, id: BotProfileId): number {
  const pf = PROFILES[id];
  let value = 0;
  for (const t of topology().vertices[v].tiles) {
    const terrain = s.map.terrains[t];
    const n = s.map.numbers[t];
    if (terrain !== 'desert' && n && pf.resources[terrain] > 1) value += (6 - Math.abs(7 - n)) * pf.resources[terrain];
  }
  return value;
}
const isSpecialist = (id: BotProfileId) => Object.values(PROFILES[id].resources).some((w) => w > 1);

/**
 * Qué tan bien le queda a un perfil lo que tiene (`own`, sus casas ya puestas) más el mejor lugar libre entre `spots`, contra lo
 * mejor que el mapa le ofrece (1 = cada casa en el mejor lugar del mapa para él). Los especialistas se miden solo por los
 * recursos que prefieren (un buen lugar es bueno para todos; lo que distingue es qué recursos da); el balanceado, por el valor
 * completo.
 */
export function profileFit(s: GameState, spots: number[], id: BotProfileId, own: number[] = []): number {
  const value = isSpecialist(id) ? (v: number) => specialty(s, v, id) : (v: number) => vertexValue(s, v, NONE, PROFILES[id]);
  const have = own.reduce((n, v) => n + value(v), 0) + Math.max(...spots.map(value));
  const bestMap = Math.max(...topology().vertices.map((_, v) => value(v)));
  return bestMap > 0 ? have / ((own.length + 1) * bestMap) : 0;
}

/**
 * El perfil (entre `available`) que mejor le queda a los lugares `spots`: un especialista (estanciero, colono) si lo libre le da
 * casi lo mejor del mapa en sus recursos (el que mejor encaje, si califican los dos); si no, el balanceado, que se arregla con lo
 * que haya. Si el que corresponde ya lo tomó otro bot, el que mejor encaje entre los que quedan. Empates, al azar.
 */
export function chooseProfile(s: GameState, spots: number[], available: BotProfileId[], rng: Rng, own: number[] = []): BotProfileId {
  const order = available.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const fits = order.map((id) => ({ id, fit: profileFit(s, spots, id, own) }));
  const bestOf = (xs: typeof fits) => xs.reduce((a, b) => (b.fit > a.fit + 1e-9 ? b : a)).id;
  const specialists = fits.filter((f) => isSpecialist(f.id) && f.fit >= SPECIALIST_FIT);
  if (specialists.length) return bestOf(specialists);
  const generalist = fits.find((f) => !isSpecialist(f.id));
  return generalist ? generalist.id : bestOf(fits);
}

/**
 * Un bot por asiento que juega como balanceado hasta su segunda casa y ahí elige su perfil (con su primera casa y los lugares
 * libres). Si ya tenía las casas puestas (la «Partida rápida» de desarrollo), elige con lo que le tocó la primera vez que juega.
 * `chosen` se llena a medida que eligen.
 */
export function makeBoardBots(isBot: boolean[], rng: Rng): { bots: Bot[]; chosen: (BotProfileId | null)[] } {
  const chosen: (BotProfileId | null)[] = isBot.map(() => null);
  const inner: (Bot | null)[] = isBot.map(() => null);
  const ids = Object.keys(PROFILES) as BotProfileId[];
  const bots = isBot.map((_, p: PlayerId): Bot => (input, r) => {
    if (!inner[p]) {
      const s = input.state!;
      const place = input.legal.find((a) => a.type === 'placeSettlement');
      const own = s.vertexBuildings.map((b, v) => (b?.player === p ? v : -1)).filter((v) => v >= 0);
      if (s.phase.kind === 'setup' && own.length === 0) return BALANCED_BOT(input, r); // la primera casa, sin estrategia todavía
      if (s.phase.kind === 'setup' && !place) return BALANCED_BOT(input, r); // el camino de la primera casa
      const free = ids.filter((id) => !chosen.includes(id));
      const spots = place && place.type === 'placeSettlement' ? place.vertices : own;
      chosen[p] = chooseProfile(s, spots, free.length ? free : ids, rng, place ? own : own.slice(1));
      inner[p] = makeSmartBot(PROFILES[chosen[p]!]);
    }
    return inner[p]!(input, r);
  });
  return { bots, chosen };
}
