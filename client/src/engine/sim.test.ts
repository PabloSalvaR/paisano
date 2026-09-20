// Simulación masiva: bots aleatorios juegan partidas enteras (colocación, dados, construcción, ladrón) y en cada paso
// se comprueban las invariantes del juego. Es la mejor forma de encontrar bugs de reglas que un test puntual no ve.

import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { applyCommand, createGame, legalActions } from './game';
import { pieceCounts } from './helpers';
import { mulberry32 } from './rng';
import { commandFor, expectConserved, NAMES } from './testutil';
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

describe('simulación: bots aleatorios', () => {
  it('120 partidas completas: nunca se traban, los recursos se conservan y las reglas se cumplen', () => {
    const seen = { discards: 0, steals: 0, cities: 0, settlementsBuilt: 0, roadsBuilt: 0, wins: 0, sevens: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const rng = mulberry32(seed * 7);
      // en la mitad de las partidas se juega a menos puntos para que también se vea el final
      let s = createGame(NAMES.slice(0, 3 + (seed % 2)), seed * 31, seed % 2 ? { victoryPoints: 5 } : {});
      for (let step = 0; step < 450 && s.phase.kind !== 'finished'; step++) {
        const p = s.turn;
        const actions = legalActions(s, p);
        expect(actions.length).toBeGreaterThan(0); // nunca se queda trabada
        // los bots prefieren construir a terminar el turno (si no, casi nunca construirían)
        const builds = actions.filter((a) => a.type.startsWith('build'));
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
          if (ev.type === 'DiceRolled' && ev.total === 7) seen.sevens++;
        }
        s = r.state;
        expectConserved(s);
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
  }, 240000);
});
