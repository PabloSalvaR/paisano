// Simulación masiva: bots aleatorios juegan partidas enteras (colocación, dados, construcción, ladrón, comercio con el banco) y en cada paso
// se comprueban las invariantes del juego. Es la mejor forma de encontrar bugs de reglas que un test puntual no ve.

import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { applyCommand, createGame, legalActions } from './game';
import { longestRoad } from './awards';
import { pieceCounts } from './helpers';
import { mulberry32 } from './rng';
import { commandFor, expectConserved, NAMES } from './testutil';
import { isActive } from '../bots/random';
import type { GameState } from './types';

const topo = topology();

function checkBoard(s: GameState): void {
  const n = s.players.length;
  for (let p = 0; p < n; p++) {
    const c = pieceCounts(s, p);
    expect(c.roads).toBeLessThanOrEqual(s.config.maxPieces.roads);
    expect(c.settlements).toBeLessThanOrEqual(s.config.maxPieces.settlements);
    expect(c.cities).toBeLessThanOrEqual(s.config.maxPieces.cities);
  }
  for (const v of topo.vertices) {
    if (!s.vertexBuildings[v.id]) continue;
    for (const nb of v.neighbors) expect(s.vertexBuildings[nb]).toBeNull(); // regla de distancia
  }
  // todo camino toca la red de su dueño: un poblado/ciudad propio en un extremo o un camino propio contiguo
  s.edgeRoads.forEach((p, id) => {
    if (p === null) return;
    const e = topo.edges[id];
    const linked = [e.a, e.b].some((v) => s.vertexBuildings[v]?.player === p || topo.vertices[v].edges.some((o) => o !== id && s.edgeRoads[o] === p));
    expect(linked).toBe(true);
  });
  expect(s.map.terrains[s.robber]).toBeDefined();
}

/** Cartas de desarrollo y reconocimientos: `playedOther` son las de progreso ya jugadas (no quedan en el estado). */
function checkCards(s: GameState, playedOther: number): void {
  const total = Object.values(s.config.devDeck).reduce((a, b) => a + b, 0);
  const inHands = s.players.reduce((n, p) => n + Object.values(p.dev).reduce((a, b) => a + b, 0), 0);
  const knights = s.players.reduce((n, p) => n + p.knightsPlayed, 0);
  expect(s.devDeck.length + inHands + knights + playedOther).toBe(total); // ninguna carta se crea ni se pierde
  for (const p of s.players) for (const k of Object.keys(p.dev) as (keyof typeof p.dev)[]) expect(p.devNew[k]).toBeLessThanOrEqual(p.dev[k]);
  const { holder: army } = s.largestArmy;
  if (army !== null) {
    expect(s.players[army].knightsPlayed).toBeGreaterThanOrEqual(s.config.largestArmyMin);
    for (const p of s.players) expect(p.knightsPlayed).toBeLessThanOrEqual(s.players[army].knightsPlayed);
  }
  const { holder: road, length } = s.longestRoad;
  if (road !== null) {
    expect(length).toBeGreaterThanOrEqual(s.config.longestRoadMin);
    expect(longestRoad(s, road)).toBe(length);
    s.players.forEach((_, p) => expect(longestRoad(s, p)).toBeLessThanOrEqual(length));
  }
}

describe('simulación: bots aleatorios', () => {
  it('120 partidas completas: nunca se traban, los recursos se conservan y las reglas se cumplen', () => {
    const seen = { discards: 0, steals: 0, cities: 0, settlementsBuilt: 0, roadsBuilt: 0, wins: 0, sevens: 0, trades: 0, bought: 0, knights: 0, monopolies: 0, plenty: 0, roadCards: 0, longest: 0, army: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const rng = mulberry32(seed * 7);
      // en la mitad de las partidas se juega a menos puntos para que también se vea el final
      let s = createGame(NAMES.slice(0, 3 + (seed % 2)), seed * 31, seed % 2 ? { victoryPoints: 5 } : {});
      let playedOther = 0;
      for (let step = 0; step < 450 && s.phase.kind !== 'finished'; step++) {
        const p = s.turn;
        const actions = legalActions(s, p);
        expect(actions.length).toBeGreaterThan(0); // nunca se queda trabada
        // los bots prefieren actuar (construir, comprar o jugar cartas) a terminar el turno (si no, casi nunca construirían)
        const builds = actions.filter(isActive);
        const pool = builds.length && rng() < 0.85 ? builds : actions;
        const a = pool[Math.floor(rng() * pool.length)];
        const r = applyCommand(s, commandFor(a, p, rng, s));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        for (const ev of r.events) {
          if (ev.type === 'Discarded') seen.discards++;
          if (ev.type === 'Stolen') seen.steals++;
          if (ev.type === 'CityBuilt') seen.cities++;
          if (ev.type === 'SettlementBuilt' && a.type === 'buildSettlement') seen.settlementsBuilt++;
          if (ev.type === 'RoadBuilt' && a.type === 'buildRoad') seen.roadsBuilt++;
          if (ev.type === 'GameWon') seen.wins++;
          if (ev.type === 'BankTraded') seen.trades++;
          if (ev.type === 'DevCardBought') seen.bought++;
          if (ev.type === 'KnightPlayed') seen.knights++;
          if (ev.type === 'MonopolyPlayed') {
            seen.monopolies++;
            playedOther++;
          }
          if (ev.type === 'YearOfPlentyPlayed') {
            seen.plenty++;
            playedOther++;
          }
          if (ev.type === 'RoadBuildingPlayed') {
            seen.roadCards++;
            playedOther++;
          }
          if (ev.type === 'LongestRoadChanged') seen.longest++;
          if (ev.type === 'LargestArmyChanged') seen.army++;
          if (ev.type === 'DiceRolled' && ev.total === 7) seen.sevens++;
        }
        s = r.state;
        expectConserved(s);
        checkCards(s, playedOther);
        if (step % 10 === 0) checkBoard(s);
      }
      checkBoard(s);
    }
    // la simulación tiene que haber ejercitado todo, si no, no prueba nada
    expect(seen.sevens).toBeGreaterThan(20);
    expect(seen.discards).toBeGreaterThan(0);
    expect(seen.steals).toBeGreaterThan(0);
    expect(seen.roadsBuilt).toBeGreaterThan(50);
    expect(seen.settlementsBuilt).toBeGreaterThan(20);
    expect(seen.cities).toBeGreaterThan(20);
    expect(seen.wins).toBeGreaterThan(5);
    expect(seen.trades).toBeGreaterThan(20);
    expect(seen.bought).toBeGreaterThan(50);
    expect(seen.knights).toBeGreaterThan(20);
    expect(seen.monopolies + seen.plenty + seen.roadCards).toBeGreaterThan(5);
    expect(seen.longest).toBeGreaterThan(0);
  }, 240000);
});
