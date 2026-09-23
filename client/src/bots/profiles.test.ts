// Perfiles de bot: el balanceado juega exactamente como el bot de siempre, ninguno queda regalado ni arrasa, y cada uno
// hace lo suyo (el estanciero sube estancias y compra cartas; el colono pone caminos y casas y pelea la ruta).

import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, legalActions, mulberry32 } from '../engine';
import type { GameState, PlayerId } from '../engine';
import { expectConserved, NAMES } from '../engine/testutil';
import { nextBot, playBots } from './play';
import { BALANCED, drawProfiles, PROFILES, type BotProfileId } from './profiles';
import type { Bot } from './random';
import { makeSmartBot, smartBot } from './smart';

interface Tally { games: number; wins: number; cities: number; settlements: number; roads: number; bought: number; road: number; army: number }

/** Una partida de bots, cada asiento con su bot; devuelve el estado final y lo que hizo cada asiento. */
function play(seed: number, bots: Bot[]) {
  const rng = mulberry32(seed * 13);
  let s: GameState = createGame(NAMES.slice(0, bots.length), seed);
  const bought = bots.map(() => 0);
  for (let guard = 0; guard < 4000 && s.phase.kind !== 'finished'; guard++) {
    const me = nextBot(s, () => true)!;
    const r = applyCommand(s, bots[me]({ me, legal: legalActions(s, me), hand: s.players[me].hand, state: s }, rng));
    expect(r.ok).toBe(true);
    if (!r.ok) break;
    for (const e of r.events) if (e.type === 'DevCardBought') bought[e.player]++;
    s = r.state;
  }
  return { s, bought };
}

/** Mesas de 3, un bot de cada perfil, rotando los asientos (las 6 permutaciones). */
function tournament(games: number): Record<BotProfileId, Tally> {
  const ids = Object.keys(PROFILES) as BotProfileId[];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const out = Object.fromEntries(ids.map((id) => [id, { games: 0, wins: 0, cities: 0, settlements: 0, roads: 0, bought: 0, road: 0, army: 0 }])) as Record<BotProfileId, Tally>;
  for (let g = 0; g < games; g++) {
    const seats = perms[g % perms.length].map((i) => ids[i]);
    const { s, bought } = play(1000 + g, seats.map((id) => makeSmartBot(PROFILES[id])));
    expectConserved(s);
    seats.forEach((id, p: PlayerId) => {
      const t = out[id];
      t.games++;
      if (s.phase.kind === 'finished' && s.phase.winner === p) t.wins++;
      for (const b of s.vertexBuildings) if (b?.player === p) { if (b.city) t.cities++; else t.settlements++; }
      t.roads += s.edgeRoads.filter((x) => x === p).length;
      t.bought += bought[p];
      if (s.longestRoad.holder === p) t.road++;
      if (s.largestArmy.holder === p) t.army++;
    });
  }
  return out;
}

describe('perfiles de bot', () => {
  it('el balanceado es el bot de siempre: mismas jugadas en las mismas partidas', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const a = play(seed, [smartBot, smartBot, smartBot]).s;
      const b = play(seed, [0, 1, 2].map(() => makeSmartBot(BALANCED))).s;
      expect(b).toEqual(a);
    }
  });

  it('se reparten sin repetir: con 3 bots sale uno de cada perfil, con 2, dos distintos', () => {
    for (let i = 0; i < 20; i++) {
      expect(new Set(drawProfiles(3, mulberry32(i))).size).toBe(3);
      expect(new Set(drawProfiles(2, mulberry32(i))).size).toBe(2);
    }
  });

  it('playBots usa el bot de cada asiento', () => {
    const s = createGame(NAMES.slice(0, 3), 3);
    const seen = new Set<PlayerId>();
    const spy = (p: PlayerId): Bot => (input, rng) => { seen.add(p); return smartBot(input, rng); };
    const out = playBots(s, () => true, mulberry32(3), [spy(0), spy(1), spy(2)]);
    expect(out.events.length).toBeGreaterThan(20);
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it('torneo: ninguno queda regalado ni arrasa, y cada uno juega a lo suyo', () => {
    const t = tournament(240);
    const avg = (id: BotProfileId, k: keyof Tally) => t[id][k] / t[id].games;
    for (const id of Object.keys(t) as BotProfileId[]) {
      expect(avg(id, 'wins')).toBeGreaterThan(0.22);
      expect(avg(id, 'wins')).toBeLessThan(0.45);
    }
    // estanciero: más estancias, más cartas y más milicias que el colono
    expect(avg('rancher', 'cities')).toBeGreaterThan(avg('settler', 'cities'));
    expect(avg('rancher', 'bought')).toBeGreaterThan(avg('settler', 'bought'));
    expect(avg('rancher', 'army')).toBeGreaterThan(avg('settler', 'army'));
    // colono: más caminos, más casas y más rutas más largas que el estanciero
    expect(avg('settler', 'roads')).toBeGreaterThan(avg('rancher', 'roads'));
    expect(avg('settler', 'settlements')).toBeGreaterThan(avg('rancher', 'settlements'));
    expect(avg('settler', 'road')).toBeGreaterThan(avg('rancher', 'road'));
  }, 120_000);
});
