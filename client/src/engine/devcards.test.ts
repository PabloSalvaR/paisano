// Cartas de desarrollo: mazo, compra, cada carta, el ejército más grande y los puntos ocultos.

import { describe, expect, it } from 'vitest';
import { topology } from './board';
import { applyCommand, createGame, legalActions } from './game';
import { publicVictoryPoints, victoryPoints } from './helpers';
import { RESOURCES } from './map';
import type { DevCardKind, GameState, PlayerId } from './types';
import { errorOf, expectConserved, mainPhaseGame, must, NAMES, setHand, totalOf } from './testutil';

const topo = topology();
const count = (s: GameState, k: DevCardKind): number => s.devDeck.filter((c) => c === k).length;

/** Le da una carta ya jugable (no comprada este turno) sacándola del mazo, para armar situaciones a mano. */
function giveCard(s: GameState, player: PlayerId, kind: DevCardKind, fresh = false): void {
  const i = s.devDeck.indexOf(kind);
  if (i < 0) throw new Error('no queda de ese tipo en el mazo');
  s.devDeck.splice(i, 1);
  s.players[player].dev[kind]++;
  if (fresh) s.players[player].devNew[kind]++;
}

const game = (): GameState => mainPhaseGame();

describe('mazo', () => {
  it('son 25 cartas con la composición del juego base, barajadas con la semilla', () => {
    const s = createGame(NAMES, 5);
    expect(s.devDeck).toHaveLength(25);
    expect(count(s, 'knight')).toBe(14);
    expect(count(s, 'victoryPoint')).toBe(5);
    expect(count(s, 'monopoly')).toBe(2);
    expect(count(s, 'yearOfPlenty')).toBe(2);
    expect(count(s, 'roadBuilding')).toBe(2);
    expect(createGame(NAMES, 5).devDeck).toEqual(s.devDeck); // misma semilla, mismo mazo
    expect(createGame(NAMES, 6).devDeck).not.toEqual(s.devDeck);
  });
});

describe('comprar una carta', () => {
  it('cuesta vaca + maíz + piedra, va a la mano como «nueva» y no se ve el tipo en el evento público', () => {
    const s = game();
    setHand(s, 0, { pasture: 1, fields: 1, mountains: 1 });
    const top = s.devDeck[s.devDeck.length - 1];
    const r = must(s, { type: 'buyDevCard', player: 0 });
    expect(r.events.map((e) => e.type)).toEqual(['ResourcesSpent', 'DevCardBought']);
    expect(r.events[1]).toMatchObject({ type: 'DevCardBought', player: 0, kind: top });
    expect(r.state.devDeck).toHaveLength(24);
    expect(r.state.players[0].dev[top]).toBe(1);
    expect(r.state.players[0].devNew[top]).toBe(1);
    expectConserved(r.state);
  });

  it('exige recursos, la fase principal y que el mazo no esté vacío', () => {
    const s = game();
    expect(errorOf(applyCommand(s, { type: 'buyDevCard', player: 0 }))).toBe('insufficient-resources');
    setHand(s, 0, { pasture: 1, fields: 1, mountains: 1 });
    expect(errorOf(applyCommand({ ...s, phase: { kind: 'roll' } }, { type: 'buyDevCard', player: 0 }))).toBe('wrong-phase');
    expect(errorOf(applyCommand({ ...s, devDeck: [] }, { type: 'buyDevCard', player: 0 }))).toBe('deck-empty');
  });

  it('aparece en las acciones legales solo si alcanza y queda mazo', () => {
    const s = game();
    expect(legalActions(s, 0).some((a) => a.type === 'buyDevCard')).toBe(false);
    setHand(s, 0, { pasture: 1, fields: 1, mountains: 1 });
    expect(legalActions(s, 0).some((a) => a.type === 'buyDevCard')).toBe(true);
    expect(legalActions({ ...s, devDeck: [] }, 0).some((a) => a.type === 'buyDevCard')).toBe(false);
  });
});

describe('reglas comunes de jugar cartas', () => {
  it('no se puede jugar la carta comprada en este turno, pero sí una de antes', () => {
    const s = game();
    giveCard(s, 0, 'monopoly', true);
    expect(errorOf(applyCommand(s, { type: 'playMonopoly', player: 0, resource: 'forest' }))).toBe('no-card');
    giveCard(s, 0, 'monopoly');
    expect(applyCommand(s, { type: 'playMonopoly', player: 0, resource: 'forest' }).ok).toBe(true);
  });

  it('una carta por turno; la siguiente hay que esperarla al próximo', () => {
    let s = game();
    giveCard(s, 0, 'monopoly');
    giveCard(s, 0, 'monopoly');
    s = must(s, { type: 'playMonopoly', player: 0, resource: 'forest' }).state;
    expect(errorOf(applyCommand(s, { type: 'playMonopoly', player: 0, resource: 'forest' }))).toBe('already-played');
    expect(legalActions(s, 0).some((a) => a.type === 'playMonopoly')).toBe(false);
    s = must(s, { type: 'endTurn', player: 0 }).state;
    s = must(s, { type: 'rollDice', player: 1 }).state;
    expect(s.devPlayed).toBe(false);
  });

  it('al terminar el turno, las cartas «nuevas» pasan a poder jugarse', () => {
    let s = game();
    giveCard(s, 0, 'yearOfPlenty', true);
    s = must(s, { type: 'endTurn', player: 0 }).state;
    expect(s.players[0].devNew.yearOfPlenty).toBe(0);
    expect(s.players[0].dev.yearOfPlenty).toBe(1);
  });

  it('no se puede jugar una carta que no se tiene, ni fuera de turno', () => {
    const s = game();
    expect(errorOf(applyCommand(s, { type: 'playKnight', player: 0 }))).toBe('no-card');
    giveCard(s, 1, 'knight');
    expect(errorOf(applyCommand(s, { type: 'playKnight', player: 1 }))).toBe('not-your-turn');
  });
});

describe('Gaucho (caballero)', () => {
  it('mueve al ladrón y roba como con un 7, pero sin descarte, y vuelve a la fase principal', () => {
    let s = game();
    giveCard(s, 0, 'knight');
    setHand(s, 1, { forest: 8 }); // más de 7: con un 7 descartaría; con el caballero no
    const r = must(s, { type: 'playKnight', player: 0 });
    expect(r.events).toEqual([{ type: 'KnightPlayed', player: 0 }]);
    s = r.state;
    expect(s.phase).toEqual({ kind: 'moveRobber', after: 'main' });
    expect(s.players[0].knightsPlayed).toBe(1);
    expect(s.players[0].dev.knight).toBe(0);
    const tile = s.map.terrains.findIndex((_, id) => id !== s.robber && topo.tiles[id].vertices.some((v) => s.vertexBuildings[v]?.player === 1));
    s = must(s, { type: 'moveRobber', player: 0, tile }).state;
    if (s.phase.kind === 'steal') s = must(s, { type: 'steal', player: 0, victim: s.phase.victims[0] }).state;
    expect(s.phase).toEqual({ kind: 'main' });
    expectConserved(s);
  });

  it('se puede jugar antes de tirar los dados y después hay que tirarlos', () => {
    let s = { ...game(), phase: { kind: 'roll' } } as GameState;
    giveCard(s, 0, 'knight');
    expect(legalActions(s, 0).map((a) => a.type)).toEqual(['rollDice', 'playKnight']);
    s = must(s, { type: 'playKnight', player: 0 }).state;
    expect(s.phase).toEqual({ kind: 'moveRobber', after: 'roll' });
    const tile = s.map.terrains.findIndex((_, id) => id !== s.robber);
    s = must(s, { type: 'moveRobber', player: 0, tile }).state;
    if (s.phase.kind === 'steal') s = must(s, { type: 'steal', player: 0, victim: s.phase.victims[0] }).state;
    expect(s.phase).toEqual({ kind: 'roll' });
  });

  it('un 7 sigue volviendo a la fase principal', () => {
    const s = { ...game(), phase: { kind: 'roll' } } as GameState;
    s.dice = { seed: findSevenSeed(), rolls: 0 };
    let r = must(s, { type: 'rollDice', player: 0 });
    expect(r.events[0]).toMatchObject({ type: 'DiceRolled', total: 7 });
    expect(r.state.phase).toEqual({ kind: 'moveRobber', after: 'main' });
    const tile = r.state.map.terrains.findIndex((_, id) => id !== r.state.robber && !topo.tiles[id].vertices.some((v) => r.state.vertexBuildings[v]));
    r = must(r.state, { type: 'moveRobber', player: 0, tile });
    expect(r.state.phase).toEqual({ kind: 'main' });
  });
});

function findSevenSeed(): number {
  for (let seed = 0; seed < 5000; seed++) {
    const s = { ...mainPhaseGame(), phase: { kind: 'roll' } } as GameState;
    s.dice = { seed, rolls: 0 };
    const r = applyCommand(s, { type: 'rollDice', player: 0 });
    if (r.ok && r.events[0].type === 'DiceRolled' && r.events[0].total === 7) return seed;
  }
  throw new Error('sin semilla con 7');
}

describe('Ejército (montonera) más grande', () => {
  const playOne = (s: GameState, player: PlayerId): GameState => {
    s.turn = player;
    s.phase = { kind: 'main' };
    s.devPlayed = false;
    giveCard(s, player, 'knight');
    let r = must(s, { type: 'playKnight', player });
    const tile = r.state.map.terrains.findIndex((_, id) => id !== r.state.robber && !topo.tiles[id].vertices.some((v) => r.state.vertexBuildings[v]));
    r = must(r.state, { type: 'moveRobber', player, tile });
    return r.state;
  };

  it('con 3 caballeros jugados se lleva el reconocimiento; con menos, no', () => {
    let s = game();
    s = playOne(s, 0);
    s = playOne(s, 0);
    expect(s.largestArmy.holder).toBeNull();
    s.turn = 0;
    s.phase = { kind: 'main' };
    s.devPlayed = false;
    giveCard(s, 0, 'knight');
    const r = must(s, { type: 'playKnight', player: 0 });
    expect(r.events).toEqual([
      { type: 'KnightPlayed', player: 0 },
      { type: 'LargestArmyChanged', player: 0, from: null, size: 3 },
    ]);
    expect(victoryPoints(r.state, 0)).toBe(victoryPoints(s, 0) + 2);
  });

  it('solo se lo saca quien lo supera estrictamente', () => {
    let s = game();
    for (let i = 0; i < 3; i++) s = playOne(s, 0);
    for (let i = 0; i < 3; i++) s = playOne(s, 1);
    expect(s.largestArmy).toEqual({ holder: 0, size: 3 }); // empate: sigue el 0
    s = playOne(s, 1);
    expect(s.largestArmy).toEqual({ holder: 1, size: 4 });
  });
});

describe('Acopio (monopolio)', () => {
  it('todos los rivales entregan todo lo que tengan de ese recurso', () => {
    const s = game();
    giveCard(s, 0, 'monopoly');
    setHand(s, 1, { forest: 3, hills: 1 });
    setHand(s, 2, { forest: 2 });
    setHand(s, 3, { hills: 4 });
    setHand(s, 0, { forest: 1 });
    const r = must(s, { type: 'playMonopoly', player: 0, resource: 'forest' });
    expect(r.events).toEqual([
      { type: 'MonopolyPlayed', player: 0, resource: 'forest', taken: [{ player: 1, amount: 3 }, { player: 2, amount: 2 }] },
    ]);
    expect(r.state.players[0].hand.forest).toBe(6);
    expect(r.state.players[1].hand).toMatchObject({ forest: 0, hills: 1 });
    expectConserved(r.state);
  });

  it('valida el recurso', () => {
    const s = game();
    giveCard(s, 0, 'monopoly');
    expect(errorOf(applyCommand(s, { type: 'playMonopoly', player: 0, resource: 'oro' as never }))).toBe('invalid-target');
  });

  it('solo se juega en la fase principal (no antes de tirar)', () => {
    const s = { ...game(), phase: { kind: 'roll' } } as GameState;
    giveCard(s, 0, 'monopoly');
    expect(errorOf(applyCommand(s, { type: 'playMonopoly', player: 0, resource: 'forest' }))).toBe('wrong-phase');
  });
});

describe('Buena cosecha (año de abundancia)', () => {
  it('toma 2 recursos del banco, iguales o distintos', () => {
    const s = game();
    giveCard(s, 0, 'yearOfPlenty');
    const r = must(s, { type: 'playYearOfPlenty', player: 0, resources: ['forest', 'mountains'] });
    expect(r.state.players[0].hand).toMatchObject({ forest: 1, mountains: 1 });
    expect(r.events[0]).toMatchObject({ type: 'YearOfPlentyPlayed', player: 0 });
    const s2 = game();
    giveCard(s2, 0, 'yearOfPlenty');
    expect(must(s2, { type: 'playYearOfPlenty', player: 0, resources: ['hills', 'hills'] }).state.players[0].hand.hills).toBe(2);
    expectConserved(r.state);
  });

  it('el banco tiene que tener lo pedido, y solo se ofrecen los recursos que hay', () => {
    const s = game();
    giveCard(s, 0, 'yearOfPlenty');
    s.bank.forest = 1;
    expect(errorOf(applyCommand(s, { type: 'playYearOfPlenty', player: 0, resources: ['forest', 'forest'] }))).toBe('bank-empty');
    const act = legalActions(s, 0).find((a) => a.type === 'playYearOfPlenty')!;
    expect(act).toBeDefined();
    s.bank.hills = 0;
    const act2 = legalActions(s, 0).find((a) => a.type === 'playYearOfPlenty');
    expect(act2 && act2.type === 'playYearOfPlenty' && act2.resources.includes('hills')).toBe(false);
  });
});

describe('Vialidad (caminos gratis)', () => {
  it('permite poner 2 caminos sin pagar y después vuelve a la fase principal', () => {
    let s = game();
    giveCard(s, 0, 'roadBuilding');
    s = must(s, { type: 'playRoadBuilding', player: 0 }).state;
    expect(s.phase).toEqual({ kind: 'roadBuilding', left: 2 });
    const first = (legalActions(s, 0)[0] as { type: 'buildRoad'; edges: number[] }).edges[0];
    const r1 = must(s, { type: 'buildRoad', player: 0, edge: first });
    expect(r1.events.map((e) => e.type)).toEqual(['RoadBuilt']); // sin ResourcesSpent
    expect(r1.state.phase).toEqual({ kind: 'roadBuilding', left: 1 });
    const second = (legalActions(r1.state, 0)[0] as { type: 'buildRoad'; edges: number[] }).edges[0];
    const r2 = must(r1.state, { type: 'buildRoad', player: 0, edge: second });
    expect(r2.state.phase).toEqual({ kind: 'main' });
    for (const res of RESOURCES) expect(totalOf(r2.state, res)).toBe(19);
  });

  it('no aparece si no hay dónde poner un camino, y termina antes si se acaban los lugares', () => {
    const s = game();
    giveCard(s, 0, 'roadBuilding');
    expect(legalActions(s, 0).some((a) => a.type === 'playRoadBuilding')).toBe(true);
    const full = game();
    giveCard(full, 0, 'roadBuilding');
    full.edgeRoads = full.edgeRoads.map((p) => (p === null ? 1 : p)); // todo ocupado
    expect(legalActions(full, 0).some((a) => a.type === 'playRoadBuilding')).toBe(false);
  });
});

describe('Estancia (punto de victoria) y puntos ocultos', () => {
  it('suma 1 punto a quien la tiene, pero los demás no lo ven', () => {
    const s = game();
    giveCard(s, 0, 'victoryPoint');
    giveCard(s, 0, 'victoryPoint');
    expect(victoryPoints(s, 0)).toBe(publicVictoryPoints(s, 0) + 2);
    expect(publicVictoryPoints(s, 0)).toBe(2); // los dos poblados de la colocación
  });

  it('comprar la que completa los puntos gana en el acto', () => {
    const s = game();
    s.config.victoryPoints = 3;
    for (let i = 0; i < 2; i++) giveCard(s, 0, 'victoryPoint');
    setHand(s, 0, { pasture: 1, fields: 1, mountains: 1 });
    s.devDeck.push('victoryPoint');
    const r = must(s, { type: 'buyDevCard', player: 0 });
    expect(r.state.phase).toEqual({ kind: 'finished', winner: 0 });
    expect(r.events.at(-1)).toEqual({ type: 'GameWon', player: 0, points: 5 });
  });

  it('las de punto de victoria no se «juegan» ni ocupan el turno', () => {
    const s = game();
    giveCard(s, 0, 'victoryPoint');
    expect(legalActions(s, 0).some((a) => a.type.startsWith('play') && a.type !== 'playKnight')).toBe(false);
  });
});
