// Bot con criterio: termina partidas sin trabarse ni romper reglas, coloca mejor que el azar y le gana al bot aleatorio.

import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, legalActions, longestRoad, mulberry32, publicVictoryPoints, topology, victoryPoints } from '../engine';
import type { GameState } from '../engine';
import { robberVictims } from '../engine/robber';
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

  it('une sus dos redes de caminos: si la colocación lo deja a 1 o 2 caminos, casi siempre las une', () => {
    const topo = topology();
    // caminos libres que faltan para unir la red de su primera casa con la de la segunda (0 = ya están unidas)
    const gap = (s: GameState, p: number): number => {
      const network = (from: number) => {
        const seen = new Set([from]);
        const stack = [from];
        while (stack.length) {
          const v = stack.pop()!;
          for (const e of topo.vertices[v].edges) {
            const w = topo.edges[e].a === v ? topo.edges[e].b : topo.edges[e].a;
            if (s.edgeRoads[e] !== p || seen.has(w)) continue;
            seen.add(w);
            stack.push(w);
          }
        }
        return seen;
      };
      const [a, b] = s.vertexBuildings.flatMap((x, v) => (x?.player === p ? [v] : []));
      const target = network(b);
      const dist = new Map([...network(a)].map((v) => [v, 0]));
      const queue = [...dist.keys()];
      while (queue.length) {
        const v = queue.shift()!;
        if (target.has(v)) return dist.get(v)!;
        if (s.vertexBuildings[v] && s.vertexBuildings[v]!.player !== p) continue;
        for (const e of topo.vertices[v].edges) {
          const w = topo.edges[e].a === v ? topo.edges[e].b : topo.edges[e].a;
          if (s.edgeRoads[e] !== null || dist.has(w)) continue;
          dist.set(w, dist.get(v)! + 1);
          queue.push(w);
        }
      }
      return Infinity;
    };
    let close = 0;
    let joined = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed * 11);
      let s = createGame(NAMES.slice(0, 3), seed);
      let near: number[] | null = null;
      for (let guard = 0; guard < 3000 && s.phase.kind !== 'finished'; guard++) {
        if (!near && s.phase.kind !== 'setup') near = [0, 1, 2].filter((p) => gap(s, p) > 0 && gap(s, p) <= 2);
        const me = nextBot(s, () => true)!;
        const r = applyCommand(s, smartBot({ me, legal: legalActions(s, me), hand: s.players[me].hand, state: s }, rng));
        if (!r.ok) break;
        s = r.state;
      }
      close += near!.length;
      joined += near!.filter((p) => gap(s, p) === 0).length;
    }
    expect(close).toBeGreaterThan(30);
    expect(joined / close).toBeGreaterThan(0.6); // antes miraba un solo camino hacia adelante y las unía menos de la mitad de las veces
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

  it('el ladrón va donde hay algo para robar: no lo pone junto al que va ganando si no tiene cartas', () => {
    const s = mainPhaseGame(7, NAMES.slice(0, 3)); // con esta semilla la casilla que más daña es solo del 1
    s.vertexBuildings = s.vertexBuildings.map((b) => (b?.player === 1 ? { ...b, city: true } : b)); // el 1 va ganando, sin cartas
    setHand(s, 2, { forest: 1, fields: 1 });
    s.phase = { kind: 'moveRobber', after: 'main' };
    const legal = legalActions(s, 0);
    const tiles = legal[0].type === 'moveRobber' ? legal[0].tiles : [];
    expect(tiles.some((t) => robberVictims(s, 0, t).includes(2))).toBe(true);
    for (let i = 0; i < 30; i++) {
      const cmd = smartBot({ me: 0, legal, hand: s.players[0].hand, state: s }, mulberry32(i));
      expect(cmd.type === 'moveRobber' && robberVictims(s, 0, cmd.tile)).toEqual([2]);
    }
    // si nadie tiene cartas, sigue yendo contra el que va ganando
    setHand(s, 2, {});
    const cmd = smartBot({ me: 0, legal, hand: s.players[0].hand, state: s }, mulberry32(1));
    expect(cmd.type === 'moveRobber' && topology().tiles[cmd.tile].vertices.some((v) => s.vertexBuildings[v]?.player === 1)).toBe(true);
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

  it('junta para la estancia: no gasta en una carta de desarrollo el maíz y la piedra que le faltan poco para subirla', () => {
    const s = mainPhaseGame(4, NAMES.slice(0, 3));
    setHand(s, 0, { pasture: 1, fields: 2, mountains: 2 }); // le alcanza para la carta y le falta 1 piedra para la estancia
    expect(legalActions(s, 0).some((a) => a.type === 'buyDevCard')).toBe(true);
    for (let i = 0; i < 30; i++) {
      const cmd = smartBot({ me: 0, legal: legalActions(s, 0), hand: s.players[0].hand, state: s }, mulberry32(i));
      expect(cmd.type).not.toBe('buyDevCard');
    }
  });

  it('con más de 7 cartas compra la carta igual: con un 7 perdería la mitad de lo que junta', () => {
    const s = mainPhaseGame(4, NAMES.slice(0, 3));
    setHand(s, 0, { pasture: 5, fields: 1, mountains: 2 }); // 8 cartas, a 2 de la estancia
    const cmd = smartBot({ me: 0, legal: legalActions(s, 0), hand: s.players[0].hand, state: s }, mulberry32(1));
    expect(cmd.type).toBe('buyDevCard');
  });

  it('con la mano llena cambia con el banco en varios pasos para subir la estancia, en vez de comprar una carta', () => {
    const s = mainPhaseGame(4, NAMES.slice(0, 3));
    setHand(s, 0, { pasture: 8, fields: 2, mountains: 1 }); // le faltan 2 piedras: con 8 vacas alcanza para dos cambios
    let hand = s.players[0].hand;
    for (let step = 0; step < 2; step++) {
      const cmd = smartBot({ me: 0, legal: legalActions(s, 0), hand, state: s }, mulberry32(step));
      expect(cmd).toMatchObject({ type: 'bankTrade', give: 'pasture', get: 'mountains' });
      const r = applyCommand(s, cmd);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      Object.assign(s, r.state);
      hand = s.players[0].hand;
    }
    const cmd = smartBot({ me: 0, legal: legalActions(s, 0), hand, state: s }, mulberry32(9));
    expect(cmd.type).toBe('buildCity');
  });

  it('entre bots se compran bastante menos cartas de desarrollo y se suben más estancias (antes se agotaba el mazo)', () => {
    let bought = 0;
    let cities = 0;
    let emptied = 0;
    const games = 40;
    for (let seed = 1; seed <= games; seed++) {
      const s = play(seed, [true, true, true, true]);
      bought += s.config.devDeck ? Object.values(s.config.devDeck).reduce((a, b) => a + b, 0) - s.devDeck.length : 0;
      cities += s.vertexBuildings.filter((b) => b?.city).length;
      if (!s.devDeck.length) emptied++;
    }
    expect(bought / games).toBeLessThan(18); // antes, ~23 de 25 por partida
    expect(emptied).toBeLessThan(games * 0.3); // antes se agotaba en el 70 % de las partidas
    expect(cities / games / 4).toBeGreaterThan(1.6); // antes, ~1,2 estancias por jugador
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
