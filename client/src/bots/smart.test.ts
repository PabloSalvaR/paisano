// Bot con criterio: termina partidas sin trabarse ni romper reglas, coloca mejor que el azar y le gana al bot aleatorio.

import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, legalActions, longestRoad, mulberry32, publicVictoryPoints, topology, victoryPoints } from '../engine';
import type { GameState } from '../engine';
import { expectConserved, mainPhaseGame, NAMES, setHand } from '../engine/testutil';
import { nextBot, playBots } from './play';
import { randomBot } from './random';
import { lateness, pips, smartBot, vertexValue } from './smart';

/** Juega una partida entera: los asientos en `smart` usan el bot con criterio y el resto el aleatorio. */
function play(seed: number, smart: boolean[], victoryPointsToWin = 10): GameState {
  const rng = mulberry32(seed * 13);
  let s = createGame(NAMES.slice(0, smart.length), seed, { victoryPoints: victoryPointsToWin });
  for (let guard = 0; guard < 3000 && s.phase.kind !== 'finished'; guard++) {
    const me = nextBot(s, () => true)!; // el de turno o, con una oferta abierta, quien tiene que responder o concretar
    const bot = smart[me] ? smartBot : randomBot;
    const r = applyCommand(s, bot({ me, legal: legalActions(s, me), hand: s.players[me].hand, state: s }, rng));
    expect(r.ok).toBe(true);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

describe('bot con criterio', () => {
  it('60 partidas entre bots con criterio: terminan, sin trabarse y con los recursos conservados', () => {
    let finished = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = play(seed, Array<boolean>(3 + (seed % 2)).fill(true));
      expectConserved(s);
      if (s.phase.kind === 'finished') finished++;
    }
    expect(finished).toBeGreaterThan(50); // la gran mayoría llega a los 10 puntos dentro del tope de jugadas
  }, 60_000);

  it('en la colocación elige un vértice mejor que el promedio', () => {
    const topo = topology();
    let better = 0;
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame(NAMES.slice(0, 3), seed);
      const legal = legalActions(s, s.turn);
      const r = applyCommand(s, smartBot({ me: s.turn, legal, hand: s.players[s.turn].hand, state: s }, mulberry32(seed)));
      if (!r.ok || r.events[0]?.type !== 'SettlementBuilt') continue;
      const chosen = r.events[0].vertex;
      const values = topo.vertices.map((v) => vertexValue(s, v.id, new Set()));
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      n++;
      if (values[chosen] > avg * 1.5) better++;
    }
    expect(n).toBe(40);
    expect(better).toBeGreaterThanOrEqual(38);
  });

  it('le gana al aleatorio: en mesas de 1 contra 3 gana bastante más de la cuarta parte', () => {
    let wins = 0;
    const games = 60;
    for (let seed = 1; seed <= games; seed++) {
      const seat = seed % 4;
      const s = play(seed, [0, 1, 2, 3].map((i) => i === seat));
      if (s.phase.kind === 'finished' && s.phase.winner === seat) wins++;
    }
    expect(wins / games).toBeGreaterThan(0.5);
  });

  it('comercian entre ellos: en partidas de bots hay ofertas, cambios concretados y rechazos, y nunca se traban', () => {
    const seen = { proposed: 0, completed: 0, rejected: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed * 5);
      let s = createGame(NAMES.slice(0, 3 + (seed % 2)), seed);
      // no debe repetir la misma oferta (mismo give/get) sin que haya pasado algo distinto en el medio (un rechazo solo,
      // que la vuelve a dejar exactamente en la misma situación, no cuenta como "algo distinto")
      let lastOffer: string | null = null;
      for (let guard = 0; guard < 3000 && s.phase.kind !== 'finished'; guard++) {
        const me = nextBot(s, () => true)!;
        const r = applyCommand(s, smartBot({ me, legal: legalActions(s, me), hand: s.players[me].hand, state: s }, rng));
        expect(r.ok).toBe(true);
        if (!r.ok) break;
        for (const e of r.events) {
          if (e.type === 'TurnChanged') lastOffer = null;
          else if (e.type === 'TradeProposed') {
            seen.proposed++;
            const key = JSON.stringify({ give: e.give, get: e.get });
            expect(key).not.toBe(lastOffer); // no insiste con la oferta que ya le rechazaron, sin más vueltas
            lastOffer = key;
          } else if (e.type !== 'TradeResponded' && e.type !== 'TradeCancelled') {
            lastOffer = null; // cualquier otra cosa (construir, comerciar con el banco, un cambio concretado…) habilita a repetir si hace falta
          }
          if (e.type === 'TradeCompleted') seen.completed++;
          if (e.type === 'TradeCancelled' && e.reason === 'rejected') seen.rejected++;
        }
        expect(s.tradeOffers).toBeLessThanOrEqual(2); // el bot no insiste más de 2 veces por turno
        s = r.state;
      }
      expectConserved(s);
    }
    expect(seen.proposed).toBeGreaterThan(15);
    expect(seen.completed).toBeGreaterThan(5);
  });

  it('con una persona consultada, los bots esperan su respuesta; con una oferta de una persona, los bots responden solos', () => {
    // mesa armada: turno del 0 (persona), fase main, colocación inicial hecha, con cartas para negociar
    const s = mainPhaseGame(4, NAMES.slice(0, 3));
    s.tradeOffers = 0;
    s.players[0].hand = { forest: 2, hills: 0, pasture: 0, fields: 0, mountains: 0 };
    s.players[1].hand = { forest: 0, hills: 2, pasture: 1, fields: 1, mountains: 0 }; // solo le falta madera para una casa
    s.players[2].hand = { forest: 0, hills: 0, pasture: 0, fields: 0, mountains: 0 };
    const isBot = (p: number) => p !== 0;
    // la persona propone: los dos bots responden en la misma tanda y la oferta queda esperando que concrete la persona
    const proposed = applyCommand(s, { type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { hills: 1 } });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const answered = playBots(proposed.state, isBot, mulberry32(1));
    expect(answered.state.trade!.responses.every((r) => r.status !== 'pending')).toBe(true);
    expect(answered.state.trade!.responses.find((r) => r.player === 1)!.status).toBe('accepted'); // con la madera completa su casa
    expect(answered.state.trade!.responses.find((r) => r.player === 2)!.status).toBe('rejected'); // no tenía ladrillo
    expect(nextBot(answered.state, isBot)).toBeNull(); // ahora decide la persona
    // un bot propone a una persona: espera su respuesta (no avanza solo)
    const t = structuredClone(answered.state);
    t.players[1].hand.mountains = 1;
    t.players[0].hand.forest = 1;
    t.trade = { from: 1, give: { mountains: 1 }, get: { forest: 1 }, responses: [{ player: 0, status: 'pending' }, { player: 2, status: 'pending' }] };
    t.turn = 1;
    const waiting = playBots(t, isBot, mulberry32(2));
    expect(waiting.state.trade!.responses.find((r) => r.player === 0)!.status).toBe('pending');
    expect(waiting.state.trade!.responses.find((r) => r.player === 2)!.status).not.toBe('pending');
  });

  it('estira la ruta en vez de dar vueltas: ningún camino comprado cierra un anillo sin alargar su ruta más larga', () => {
    const topo = topology();
    let roads = 0;
    let rings = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed * 7);
      let s = createGame(NAMES.slice(0, 3 + (seed % 2)), seed);
      for (let guard = 0; guard < 3000 && s.phase.kind !== 'finished'; guard++) {
        const me = nextBot(s, () => true)!;
        const cmd = smartBot({ me, legal: legalActions(s, me), hand: s.players[me].hand, state: s }, rng);
        const r = applyCommand(s, cmd);
        expect(r.ok).toBe(true);
        if (!r.ok) break;
        if (cmd.type === 'buildRoad') {
          roads++;
          const e = topo.edges[cmd.edge];
          const mineBefore = (v: number) => s.vertexBuildings[v]?.player === me || topo.vertices[v].edges.some((x) => s.edgeRoads[x] === me);
          if (mineBefore(e.a) && mineBefore(e.b) && longestRoad(r.state, me) <= longestRoad(s, me)) rings++;
        }
        s = r.state;
      }
    }
    expect(roads).toBeGreaterThan(100);
    expect(rings).toBe(0);
  }, 60_000);

  it('al final de la partida no propone cambios aunque le falte una sola carta', () => {
    const s = mainPhaseGame(4, NAMES.slice(0, 3));
    s.tradeOffers = 0;
    // el jugador 1 llega a 8 de 10: sus dos casas pasan a estancias y tiene los dos reconocimientos
    s.vertexBuildings = s.vertexBuildings.map((b) => (b?.player === 1 ? { ...b, city: true } : b));
    s.longestRoad = { holder: 1, length: 5 };
    s.largestArmy = { holder: 1, size: 3 };
    expect(publicVictoryPoints(s, 1)).toBe(8);
    expect(lateness(s)).toBe(0.8);
    setHand(s, 0, { forest: 1, hills: 1, pasture: 1, mountains: 2 }); // le falta solo maíz para la casa: al principio ofrecería
    for (let i = 0; i < 50; i++) {
      const cmd = smartBot({ me: 0, legal: legalActions(s, 0), hand: s.players[0].hand, state: s }, mulberry32(i));
      expect(cmd.type).not.toBe('proposeTrade');
    }
  });

  it('a medida que avanza la partida los bots comercian mucho menos, y al que va ganando casi no le dan nada', () => {
    const early = { proposed: 0, turns: 0 };
    const late = { proposed: 0, turns: 0 };
    let toLeader = 0;
    let leaderAccepted = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed * 11);
      let s = createGame(NAMES.slice(0, 3 + (seed % 2)), seed);
      for (let guard = 0; guard < 3000 && s.phase.kind !== 'finished'; guard++) {
        const me = nextBot(s, () => true)!;
        const r = applyCommand(s, smartBot({ me, legal: legalActions(s, me), hand: s.players[me].hand, state: s }, rng));
        if (!r.ok) break;
        const bucket = lateness(s) >= 0.6 ? late : lateness(s) === 0 ? early : null;
        for (const e of r.events) {
          if (e.type === 'TurnChanged' && bucket) bucket.turns++;
          if (e.type === 'TradeProposed' && bucket) bucket.proposed++;
          // respuestas a ofertas del que va primero, ya avanzada la partida
          if (e.type === 'TradeResponded' && s.trade && lateness(s) >= 0.4) {
            const from = s.trade.from;
            if (s.players.every((_, q) => publicVictoryPoints(s, q) < publicVictoryPoints(s, from) || q === from)) {
              toLeader++;
              if (e.accept) leaderAccepted++;
            }
          }
        }
        s = r.state;
      }
    }
    expect(early.proposed / early.turns).toBeGreaterThan(3 * (late.proposed / Math.max(1, late.turns)));
    expect(leaderAccepted).toBeLessThanOrEqual(toLeader * 0.2);
  }, 60_000);

  it('las fichas 6 y 8 puntúan más que las 2 y 12', () => {
    expect(pips(6)).toBe(5);
    expect(pips(8)).toBe(5);
    expect(pips(2)).toBe(1);
    expect(pips(0)).toBe(0);
  });

  it('el motor de partidas por sala usa este bot por defecto y termina la jugada de los bots', () => {
    const s = createGame(NAMES.slice(0, 3), 5);
    const out = playBots(s, () => true, mulberry32(5));
    expect(out.events.length).toBeGreaterThan(50);
    expectConserved(out.state);
    expect(victoryPoints(out.state, 0)).toBeGreaterThanOrEqual(0);
  });
});
