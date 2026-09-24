// Perfiles de bot: la «personalidad» de cada rival. Es el mismo bot con criterio (`smart.ts`) con otros pesos, no una regla del
// juego: el motor no se entera. En la partida contra bots cada bot elige uno distinto según el tablero (ver adaptive.ts), y no
// se muestra (se descubre jugando). El balanceado es el bot de siempre: con él todo lo que ya existía (salas, simulaciones) juega igual.

import type { Resource } from '../engine';

export type BotProfileId = 'balanced' | 'rancher' | 'settler';

export interface BotProfile {
  id: BotProfileId;
  /** Cuánto le interesa cada recurso al elegir dónde poner una casa (multiplica los puntitos de la ficha; también pesa el puerto 2:1 de ese recurso). */
  resources: Record<Resource, number>;
  /** Premio por cada recurso distinto que toca un lugar: más alto, más variedad; más bajo, se especializa. */
  variety: number;
  /** Si puede pagar las dos, pone la casa antes que subir la estancia. */
  settlementFirst: boolean;
  /** Hasta cuántas cartas le pueden faltar para una estancia o una casa y todavía juntar para ella en vez de comprar una carta de desarrollo. */
  saveWithin: number;
  /** Si también junta para una casa (si no, solo para la estancia: compra más cartas). */
  saveForSettlement: boolean;
  /** Juega el Gaucho en cuanto puede (antes de tirar), para ir por la Milicia más grande. */
  eagerKnight: boolean;
  /** Cuánto vale estirar la ruta continua más larga con un camino. */
  stretch: number;
  /** Pelea la Ruta más larga aunque un rival le lleve mucha ventaja. */
  fightRoad: boolean;
  /** Si no es null, compra caminos solo para llegar a un lugar nuevo y mientras tenga menos de estas construcciones (casas más estancias). */
  roadGoal: number | null;
  /** En la colocación se asegura madera o barro: si la primera casa no toca ninguno, la segunda va a un lugar que toque alguno. */
  buildResource: boolean;
  /** Ruta oportunista: si no es null, aunque `roadGoal` lo frene, compra caminos que estiren su ruta cuando le faltan hasta estos
   *  para quedarse con la Ruta más larga. */
  roadChance: number | null;
}

const EVEN: Record<Resource, number> = { forest: 1, hills: 1, pasture: 1, fields: 1, mountains: 1 };

/** El bot de siempre: hace lo que más rinde en cada momento. */
export const BALANCED: BotProfile = {
  id: 'balanced',
  resources: EVEN,
  variety: 0.6,
  settlementFirst: false,
  saveWithin: 2,
  saveForSettlement: true,
  eagerKnight: false,
  stretch: 2,
  fightRoad: false,
  roadGoal: null,
  buildResource: false,
  roadChance: null,
};

/** Estanciero: vaca, maíz y piedra (más madera o barro asegurados en la colocación, para poder expandirse); estancias y cartas de
 *  desarrollo (apunta a 4 estancias y puntos ocultos, con la milicia de remate). */
export const RANCHER: BotProfile = {
  id: 'rancher',
  resources: { forest: 1, hills: 1, pasture: 1.1, fields: 1.5, mountains: 1.5 }, // piedra y maíz antes que vaca: son lo que piden las estancias
  variety: 0.3,
  settlementFirst: false,
  saveWithin: 2,
  saveForSettlement: false,
  eagerKnight: true,
  stretch: 1,
  fightRoad: false,
  roadGoal: 4, // 4 casas para subir a 4 estancias: 4 caminos alcanzan (2 de la colocación y 1 por cada casa nueva)
  buildResource: true,
  roadChance: 2, // si le faltan 2 caminos o menos para la Ruta más larga, la va a buscar
};

/** Colono: madera y ladrillo; caminos, casas y la Ruta más larga (apunta a la ruta, 4 casas y 2 estancias). */
export const SETTLER: BotProfile = {
  id: 'settler',
  resources: { forest: 1.2, hills: 1.2, pasture: 1, fields: 1, mountains: 1 },
  variety: 0.6,
  settlementFirst: true,
  saveWithin: 2,
  saveForSettlement: true,
  eagerKnight: false,
  stretch: 3,
  fightRoad: true,
  roadGoal: null,
  buildResource: false,
  roadChance: null,
};

export const PROFILES: Record<BotProfileId, BotProfile> = { balanced: BALANCED, rancher: RANCHER, settler: SETTLER };

/** Reparte perfiles distintos a `count` bots (con 3 sale uno de cada uno; con 2, dos de los tres al azar). */
export function drawProfiles(count: number, rng: () => number): BotProfileId[] {
  const pool = Object.keys(PROFILES) as BotProfileId[];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}
