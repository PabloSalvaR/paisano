import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { applyCommand, createGame, legalActions, setupPlayer } from './game';
import { canSettleAt } from './helpers';
import { rollDiceFor } from './dice';
import { generateMap, RESOURCES, spiralNumbers, type Resource } from './map';
import { mulberry32 } from './rng';
import { commandFor } from './testutil';
import type { Command, GameEvent, GameState, PlayerId, Result } from './types';

const NAMES = ['Tomás', 'Lucía', 'Mateo', 'Sofía'];

/** Aplica un comando que tiene que ser legal; si no, el test falla con el error. */
function must(state: GameState, cmd: Command): { state: GameState; events: GameEvent[] } {
  const r = applyCommand(state, cmd);
  if (!r.ok) throw new Error(`${cmd.type} rechazado: ${r.error.code} — ${r.error.message}`);
  return r;
}

function errorOf(r: Result): string {
  if (r.ok) throw new Error('se esperaba un error');
  return r.error.code;
}

/** Vértices posibles para el poblado inicial, en orden de id (elige el primero libre que cumple la distancia). */
function firstSettlement(state: GameState, player: PlayerId): number {
  const a = legalActions(state, player)[0];
  if (a.type !== 'placeSettlement') throw new Error('se esperaba placeSettlement');
  return a.vertices[0];
}

/** Juega la colocación inicial completa eligiendo siempre la primera opción legal. */
function playSetup(state: GameState, log: { player: PlayerId; kind: string }[] = []): GameState {
  let s = state;
  while (s.phase.kind === 'setup') {
    const p = s.turn;
    const a = legalActions(s, p)[0];
    if (a.type === 'placeSettlement') {
      s = must(s, { type: 'placeSettlement', player: p, vertex: a.vertices[0] }).state;
      log.push({ player: p, kind: 'settlement' });
    } else if (a.type === 'placeRoad') {
      s = must(s, { type: 'placeRoad', player: p, edge: a.edges[0] }).state;
      log.push({ player: p, kind: 'road' });
    }
  }
  return s;
}

const totalResources = (s: GameState, r: (typeof RESOURCES)[number]) =>
  s.bank[r] + s.players.reduce((n, p) => n + p.hand[r], 0);

describe('creación', () => {
  it('arranca vacío: sin piezas, manos en 0, banco lleno y el ladrón en el desierto', () => {
    const s = createGame(NAMES, 1);
    expect(s.players).toHaveLength(4);
    for (const p of s.players) expect(Object.values(p.hand).every((n) => n === 0)).toBe(true);
    for (const r of RESOURCES) expect(s.bank[r]).toBe(19);
    expect(s.vertexBuildings.every((b) => b === null)).toBe(true);
    expect(s.edgeRoads.every((e) => e === null)).toBe(true);
    expect(s.robber).toBe(s.map.desert);
    expect(s.turn).toBe(0);
    expect(s.phase).toEqual({ kind: 'setup', step: 0, part: 'settlement', lastSettlement: null });
  });

  it('acepta 3 o 4 jugadores y rechaza otra cantidad', () => {
    expect(createGame(NAMES.slice(0, 3), 1).players).toHaveLength(3);
    expect(() => createGame(NAMES.slice(0, 2), 1)).toThrow();
    expect(() => createGame([...NAMES, 'Extra'], 1)).toThrow();
  });

  it('el estado es JSON puro (se puede guardar y recuperar sin perder nada)', () => {
    const s = playSetup(createGame(NAMES, 5));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('la misma semilla da la misma partida', () => {
    expect(createGame(NAMES, 99)).toEqual(createGame(NAMES, 99));
  });
});

describe('colocación inicial: orden', () => {
  it('el orden de pasos es 1-2-3-4-4-3-2-1 (3 jugadores: 1-2-3-3-2-1)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => setupPlayer(i, 4))).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect([0, 1, 2, 3, 4, 5].map((i) => setupPlayer(i, 3))).toEqual([0, 1, 2, 2, 1, 0]);
  });

  it('cada jugador coloca poblado y camino; el último juega dos veces seguidas', () => {
    const log: { player: PlayerId; kind: string }[] = [];
    playSetup(createGame(NAMES, 7), log);
    expect(log.map((l) => `${l.player}${l.kind[0]}`)).toEqual([
      '0s', '0r', '1s', '1r', '2s', '2r', '3s', '3r', '3s', '3r', '2s', '2r', '1s', '1r', '0s', '0r',
    ]);
  });

  it('al terminar la colocación empieza la ronda de dados por el jugador 1', () => {
    const s = playSetup(createGame(NAMES, 7));
    expect(s.phase).toEqual({ kind: 'roll' });
    expect(s.turn).toBe(0);
  });

  it('cada jugador termina con 2 poblados y 2 caminos', () => {
    const s = playSetup(createGame(NAMES, 11));
    for (let p = 0; p < 4; p++) {
      expect(s.vertexBuildings.filter((b) => b?.player === p && !b.city)).toHaveLength(2);
      expect(s.edgeRoads.filter((e) => e === p)).toHaveLength(2);
    }
  });
});

describe('colocación inicial: recursos', () => {
  it('el 1.º poblado no da nada; el 2.º da un recurso por cada casilla que toca (menos el desierto)', () => {
    let s = createGame(NAMES, 21);
    const topo = topology();
    // primera vuelta: nadie cobra
    for (let i = 0; i < 4; i++) {
      const p = s.turn;
      const v = firstSettlement(s, p);
      const r = must(s, { type: 'placeSettlement', player: p, vertex: v });
      expect(r.events.some((e) => e.type === 'ResourcesDistributed')).toBe(false);
      s = r.state;
      const road = legalActions(s, p)[0];
      if (road.type !== 'placeRoad') throw new Error('x');
      s = must(s, { type: 'placeRoad', player: p, edge: road.edges[0] }).state;
    }
    for (const p of s.players) expect(Object.values(p.hand).every((n) => n === 0)).toBe(true);
    // segunda vuelta: el jugador 4 (turno actual) coloca su 2.º poblado y cobra
    const p = s.turn;
    expect(p).toBe(3);
    const v = firstSettlement(s, p);
    const expected: Record<string, number> = {};
    for (const t of topo.vertices[v].tiles) {
      const terrain = s.map.terrains[t];
      if (terrain !== 'desert') expected[terrain] = (expected[terrain] ?? 0) + 1;
    }
    const r = must(s, { type: 'placeSettlement', player: p, vertex: v });
    for (const res of RESOURCES) expect(r.state.players[p].hand[res]).toBe(expected[res] ?? 0);
    const total = Object.values(expected).reduce((a, b) => a + b, 0);
    expect(RESOURCES.reduce((n, res) => n + r.state.bank[res], 0)).toBe(95 - total);
  });

  it('solo cobran los 2.os poblados: al terminar, cada mano suma lo de sus casillas y los recursos se conservan', () => {
    const s = playSetup(createGame(NAMES, 33));
    for (const res of RESOURCES) expect(totalResources(s, res)).toBe(19);
  });
});

describe('colocación inicial: errores', () => {
  const s0 = createGame(NAMES, 3);

  it('rechaza actuar fuera de turno, en fase equivocada y con datos inválidos, sin lanzar', () => {
    expect(errorOf(applyCommand(s0, { type: 'placeSettlement', player: 1, vertex: 0 }))).toBe('not-your-turn');
    expect(errorOf(applyCommand(s0, { type: 'placeSettlement', player: 9, vertex: 0 }))).toBe('unknown-player');
    expect(errorOf(applyCommand(s0, { type: 'placeRoad', player: 0, edge: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand(s0, { type: 'rollDice', player: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand(s0, { type: 'endTurn', player: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand(s0, { type: 'placeSettlement', player: 0, vertex: 999 }))).toBe('invalid-vertex');
    expect(errorOf(applyCommand(s0, { type: 'placeSettlement', player: 0, vertex: -1 }))).toBe('invalid-vertex');
    expect(errorOf(applyCommand(s0, { type: 'placeSettlement', player: 0, vertex: 1.5 }))).toBe('invalid-vertex');
  });

  it('rechaza un poblado sobre otro y a un solo camino de distancia', () => {
    const v = firstSettlement(s0, 0);
    const s1 = must(s0, { type: 'placeSettlement', player: 0, vertex: v }).state;
    const edge = topology().vertices[v].edges[0];
    const s2 = must(s1, { type: 'placeRoad', player: 0, edge }).state; // ahora juega el jugador 1
    expect(errorOf(applyCommand(s2, { type: 'placeSettlement', player: 1, vertex: v }))).toBe('occupied');
    for (const n of topology().vertices[v].neighbors) {
      expect(errorOf(applyCommand(s2, { type: 'placeSettlement', player: 1, vertex: n }))).toBe('too-close');
      expect(canSettleAt(s2, n)).toBe(false);
    }
  });

  it('el camino inicial tiene que salir del poblado recién colocado y no puede repetirse', () => {
    const v = firstSettlement(s0, 0);
    const s1 = must(s0, { type: 'placeSettlement', player: 0, vertex: v }).state;
    const own = topology().vertices[v].edges;
    const far = topology().edges.find((e) => e.a !== v && e.b !== v)!.id;
    expect(errorOf(applyCommand(s1, { type: 'placeRoad', player: 0, edge: far }))).toBe('not-connected');
    expect(errorOf(applyCommand(s1, { type: 'placeRoad', player: 0, edge: 9999 }))).toBe('invalid-edge');
    expect(errorOf(applyCommand(s1, { type: 'placeSettlement', player: 0, vertex: v }))).toBe('wrong-phase');
    const s2 = must(s1, { type: 'placeRoad', player: 0, edge: own[0] }).state;
    expect(s2.edgeRoads[own[0]]).toBe(0);
  });

  it('un comando rechazado no modifica el estado', () => {
    const before = JSON.stringify(s0);
    applyCommand(s0, { type: 'placeSettlement', player: 1, vertex: 0 });
    expect(JSON.stringify(s0)).toBe(before);
  });

  it('un comando aceptado tampoco modifica el estado original (devuelve uno nuevo)', () => {
    const before = JSON.stringify(s0);
    const r = must(s0, { type: 'placeSettlement', player: 0, vertex: firstSettlement(s0, 0) });
    expect(JSON.stringify(s0)).toBe(before);
    expect(r.state).not.toBe(s0);
  });
});

describe('acciones legales', () => {
  it('solo el jugador de turno tiene acciones', () => {
    const s = createGame(NAMES, 4);
    expect(legalActions(s, 0)).toHaveLength(1);
    expect(legalActions(s, 1)).toEqual([]);
  });

  it('todas las acciones que declara legales el motor las acepta el motor', () => {
    const s = createGame(NAMES, 4);
    const a = legalActions(s, 0)[0];
    if (a.type !== 'placeSettlement') throw new Error('x');
    expect(a.vertices).toHaveLength(54);
    for (const vertex of a.vertices) expect(applyCommand(s, { type: 'placeSettlement', player: 0, vertex }).ok).toBe(true);
  });
});

describe('dados y producción', () => {
  it('las tiradas dependen solo de semilla + contador, y dan valores de 1 a 6', () => {
    expect(rollDiceFor(5, 0)).toEqual(rollDiceFor(5, 0));
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const [a, b] = rollDiceFor(5, i);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
      seen.add(a + b);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('rollDice consume una tirada, pasa a "main" y solo el jugador de turno puede tirar', () => {
    const s = playSetup(createGame(NAMES, 8));
    expect(errorOf(applyCommand(s, { type: 'rollDice', player: 1 }))).toBe('not-your-turn');
    const r = must(s, { type: 'rollDice', player: 0 });
    const ev = r.events.find((e) => e.type === 'DiceRolled')!;
    if (ev.type !== 'DiceRolled') throw new Error('x');
    expect(ev.dice).toEqual(rollDiceFor(s.dice.seed, 0));
    expect(ev.total).toBe(ev.dice[0] + ev.dice[1]);
    expect(r.state.dice.rolls).toBe(1);
    expect(r.state.phase).toEqual({ kind: 'main' });
    expect(errorOf(applyCommand(r.state, { type: 'rollDice', player: 0 }))).toBe('wrong-phase');
  });

  it('endTurn pasa al siguiente jugador en sentido horario y vuelve a pedir dados', () => {
    let s = playSetup(createGame(NAMES, 8));
    const seenTurns: number[] = [];
    for (let i = 0; i < 8; i++) {
      seenTurns.push(s.turn);
      s = must(s, { type: 'rollDice', player: s.turn }).state;
      // si salió un 7, se resuelve el ladrón (descarte, mover y robar) con las primeras opciones legales
      const rng = mulberry32(i + 1);
      while (s.phase.kind !== 'main') s = must(s, commandFor(legalActions(s, s.turn)[0], s.turn, rng, s)).state;
      expect(s.turn).toBe(seenTurns[i]); // el ladrón lo mueve quien tiró
      s = must(s, { type: 'endTurn', player: s.turn }).state;
      expect(s.phase).toEqual({ kind: 'roll' });
    }
    expect(seenTurns).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  /** Devuelve un estado en fase 'roll' con la partida armada a mano y los dados forzados a `total`. */
  function rigged(total: number, seed = 8): GameState {
    const base = playSetup(createGame(NAMES, seed));
    // se busca un contador de tiradas que produzca ese total
    let k = 0;
    while (rollDiceFor(base.dice.seed, k).reduce((a, b) => a + b, 0) !== total) k++;
    return { ...base, dice: { ...base.dice, rolls: k } };
  }

  it('un poblado cobra 1 carta y una ciudad 2 por casilla con el número que sale', () => {
    const s = rigged(6);
    const topo = topology();
    const tile = topo.tiles.find((t) => s.map.numbers[t.id] === 6)!;
    // se limpian las piezas y se arma: jugador 0 con poblado, jugador 1 con ciudad, en la misma casilla
    s.vertexBuildings = s.vertexBuildings.map(() => null);
    s.vertexBuildings[tile.vertices[0]] = { player: 0, city: false };
    s.vertexBuildings[tile.vertices[3]] = { player: 1, city: true };
    for (const p of s.players) for (const r of RESOURCES) { s.bank[r] += p.hand[r]; p.hand[r] = 0; }
    const res = s.map.terrains[tile.id] as Resource;
    const r = must(s, { type: 'rollDice', player: 0 });
    // otras casillas con 6 también podrían tocar esas esquinas; se comprueba al menos lo de esta casilla
    expect(r.state.players[0].hand[res]).toBeGreaterThanOrEqual(1);
    expect(r.state.players[1].hand[res]).toBeGreaterThanOrEqual(2);
    for (const x of RESOURCES) expect(totalResources(r.state, x)).toBe(19);
  });

  it('el ladrón bloquea la producción de su casilla', () => {
    const s = rigged(6);
    const topo = topology();
    const tile = topo.tiles.find((t) => s.map.numbers[t.id] === 6)!;
    s.vertexBuildings = s.vertexBuildings.map(() => null);
    s.vertexBuildings[tile.vertices[0]] = { player: 0, city: false };
    for (const p of s.players) for (const r of RESOURCES) { s.bank[r] += p.hand[r]; p.hand[r] = 0; }
    s.robber = tile.id;
    const before = totalResources(s, s.map.terrains[tile.id] as (typeof RESOURCES)[number]);
    const r = must(s, { type: 'rollDice', player: 0 });
    const others = topo.vertices[tile.vertices[0]].tiles.filter((t) => t !== tile.id && s.map.numbers[t] === 6);
    if (!others.length) expect(r.state.players[0].hand[s.map.terrains[tile.id] as (typeof RESOURCES)[number]]).toBe(0);
    expect(totalResources(r.state, s.map.terrains[tile.id] as (typeof RESOURCES)[number])).toBe(before);
  });

  it('con un 7 nadie cobra y el turno pasa al ladrón (sin descarte si nadie tiene más de 7 cartas)', () => {
    const s = rigged(7);
    const handsBefore = JSON.stringify(s.players);
    const r = must(s, { type: 'rollDice', player: 0 });
    expect(JSON.stringify(r.state.players)).toBe(handsBefore);
    expect(r.state.phase).toEqual({ kind: 'moveRobber', after: 'main' });
    expect(r.events.some((e) => e.type === 'ResourcesDistributed')).toBe(false);
  });

  it('si el banco no alcanza y cobran varios, nadie cobra ese recurso; si cobra uno solo, recibe lo que queda', () => {
    const topo = topology();
    const make = (twoPlayers: boolean) => {
      const s = rigged(6);
      const tile = topo.tiles.find((t) => s.map.numbers[t.id] === 6)!;
      s.vertexBuildings = s.vertexBuildings.map(() => null);
      s.vertexBuildings[tile.vertices[0]] = { player: 0, city: true };
      if (twoPlayers) s.vertexBuildings[tile.vertices[3]] = { player: 1, city: false };
      for (const p of s.players) for (const r of RESOURCES) { s.bank[r] += p.hand[r]; p.hand[r] = 0; }
      s.robber = -1; // ninguna casilla bloqueada
      const res = s.map.terrains[tile.id] as (typeof RESOURCES)[number];
      s.bank[res] = 1; // queda 1 carta; el resto (18) se saca de circulación solo para el ejemplo
      return { s, res, tile };
    };
    const solo = make(false);
    const r1 = must(solo.s, { type: 'rollDice', player: 0 });
    // una ciudad pide 2 por casilla y hay 1: recibe 1 por esa casilla (más lo de otras casillas 6 que toquen, ya sin banco)
    expect(r1.state.players[0].hand[solo.res]).toBe(1);
    expect(r1.state.bank[solo.res]).toBe(0);

    const two = make(true);
    const r2 = must(two.s, { type: 'rollDice', player: 0 });
    expect(r2.state.players[0].hand[two.res]).toBe(0);
    expect(r2.state.players[1].hand[two.res]).toBe(0);
    expect(r2.state.bank[two.res]).toBe(1);
  });
});

describe('quién abre la partida', () => {
  it('con first = 2: fase 1 horaria 2-3-0-1 y fase 2 antihoraria 1-0-3-2; el primer turno es del 2', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => setupPlayer(i, 4, 2))).toEqual([2, 3, 0, 1, 1, 0, 3, 2]);
    const log: { player: PlayerId; kind: string }[] = [];
    const s = playSetup(createGame(NAMES, 7, { firstPlayer: 2 }), log);
    expect(log.filter((l) => l.kind === 'settlement').map((l) => l.player)).toEqual([2, 3, 0, 1, 1, 0, 3, 2]);
    expect(s.first).toBe(2);
    expect(s.turn).toBe(2);
    expect(s.phase).toEqual({ kind: 'roll' });
  });

  it('con firstPlayer null se sortea con la semilla: reproducible y con todos los asientos posibles', () => {
    const firsts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) => createGame(NAMES, seed, { firstPlayer: null }).first);
    expect(firsts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) => createGame(NAMES, seed, { firstPlayer: null }).first));
    expect(new Set(firsts).size).toBeGreaterThan(1);
    firsts.forEach((f) => expect(f >= 0 && f < NAMES.length).toBe(true));
  });
});

describe('victoria al empezar el turno', () => {
  const almostWon = (): GameState => {
    const s = playSetup(createGame(NAMES, 7, { victoryPoints: 3 })); // todos tienen 2 puntos
    s.phase = { kind: 'main' };
    s.turn = 0;
    s.largestArmy = { holder: 2, size: 3 }; // el jugador 2 llegó a 4 por un reconocimiento, sin que fuera su turno
    return s;
  };

  it('quien ya tiene los puntos gana al llegarle el turno, sin tirar los dados', () => {
    let s = almostWon();
    s = must(s, { type: 'endTurn', player: 0 }).state; // le toca al 1: tiene 2, la partida sigue
    expect(s.phase).toEqual({ kind: 'roll' });
    s.phase = { kind: 'main' };
    const r = must(s, { type: 'endTurn', player: 1 }); // le toca al 2: tiene 4
    expect(r.state.phase).toEqual({ kind: 'finished', winner: 2 });
    expect(r.events.map((e) => e.type)).toEqual(['TurnChanged', 'GameWon']);
  });

  it('en el turno de otro no gana: solo cuando le llega el suyo', () => {
    const s = almostWon();
    expect(s.phase.kind).toBe('main');
    expect(s.turn).toBe(0);
  });
});

describe('sorteo de quién abre (tirada de dados)', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
  const total = (r: { roll: [number, number] }): number => r.roll[0] + r.roll[1];

  it('cada ronda la tiran los que empataron arriba; la última tiene un ganador único: ese abre', () => {
    for (const seed of seeds) {
      const s = createGame(NAMES, seed, { firstPlayer: null });
      const rounds = s.opening!;
      expect(rounds.length).toBeGreaterThanOrEqual(1);
      expect(rounds[0].map((r) => r.player)).toEqual([0, 1, 2, 3]); // la primera la tiran todos
      rounds.forEach((round, i) => {
        round.forEach((r) => r.roll.forEach((d) => expect(d >= 1 && d <= 6).toBe(true)));
        const max = Math.max(...round.map(total));
        const top = round.filter((r) => total(r) === max).map((r) => r.player);
        if (i < rounds.length - 1) {
          expect(top.length).toBeGreaterThan(1); // hubo empate: la siguiente ronda es solo de esos
          expect(rounds[i + 1].map((r) => r.player)).toEqual(top);
        } else {
          expect(top).toEqual([s.first]); // desempate resuelto: gana el único con el mayor total
        }
      });
    }
  });

  it('es reproducible con la misma semilla, y hay semillas con empate y con distintos ganadores', () => {
    expect(createGame(NAMES, 9, { firstPlayer: null }).opening).toEqual(createGame(NAMES, 9, { firstPlayer: null }).opening);
    const games = seeds.map((seed) => createGame(NAMES, seed, { firstPlayer: null }));
    expect(games.some((g) => g.opening!.length > 1)).toBe(true);
    expect(new Set(games.map((g) => g.first)).size).toBeGreaterThan(1);
  });

  it('con un primer jugador fijo no hay tirada', () => {
    const s = createGame(NAMES, 9, { firstPlayer: 2 });
    expect(s.opening).toBeUndefined();
    expect(s.first).toBe(2);
    expect(s.turn).toBe(2);
  });

  it('funciona con 3 jugadores y la colocación arranca por quien ganó', () => {
    const s = createGame(['A', 'B', 'C'], 4, { firstPlayer: null });
    expect(s.opening![0].map((r) => r.player)).toEqual([0, 1, 2]);
    expect(s.turn).toBe(s.first);
  });
});

describe('reparto de números (GameConfig.numberPlacement)', () => {
  it('por defecto va en serie (espiral de las letras); con "random" (Caos) sale el reparto al azar', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const serie = createGame(NAMES, seed);
      expect(serie.config.numberPlacement).toBe('spiral');
      expect([0, 1, 2, 3, 4, 5].some((start) => JSON.stringify(spiralNumbers(topology(), serie.map.terrains, start)) === JSON.stringify(serie.map.numbers))).toBe(true);
      const caos = createGame(NAMES, seed, { numberPlacement: 'random' });
      expect(caos.map).toEqual(generateMap(topology(), mulberry32(seed), 'random'));
    }
  });
});
