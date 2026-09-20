import { describe, expect, it } from 'vitest';
import { applyCommand, legalActions } from './game';
import { RESOURCES, type Port, type Resource } from './map';
import { bankTradeOptions, tradeRate } from './trade';
import { errorOf, expectConserved, mainPhaseGame, must, setHand } from './testutil';
import type { GameState, PlayerId } from './types';

/** Partida en fase "main" con el tablero vacío de piezas, para poner poblados solo donde el test lo pide. */
function emptyBoard(): GameState {
  const s = mainPhaseGame();
  s.vertexBuildings = s.vertexBuildings.map(() => null);
  s.edgeRoads = s.edgeRoads.map(() => null);
  return s;
}

const genericPort = (s: GameState): Port => s.map.ports.find((p) => p.resource === null)!;
const portOf = (s: GameState, r: Resource): Port => s.map.ports.find((p) => p.resource === r)!;

/** Pone un poblado (o ciudad) del jugador en un vértice del puerto. */
function settleOnPort(s: GameState, player: PlayerId, port: Port, city = false, which: 0 | 1 = 0): void {
  s.vertexBuildings[port.vertices[which]] = { player, city };
}

describe('comercio con el banco: tasa', () => {
  it('sin puertos es 4:1 para todos los recursos', () => {
    const s = emptyBoard();
    for (const r of RESOURCES) expect(tradeRate(s, 0, r)).toBe(4);
  });

  it('un puerto genérico da 3:1 en todos los recursos', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, genericPort(s));
    for (const r of RESOURCES) expect(tradeRate(s, 0, r)).toBe(3);
  });

  it('un puerto específico da 2:1 solo en su recurso', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, portOf(s, 'forest'));
    expect(tradeRate(s, 0, 'forest')).toBe(2);
    for (const r of RESOURCES.filter((x) => x !== 'forest')) expect(tradeRate(s, 0, r)).toBe(4);
  });

  it('gana la mejor tasa disponible: específico + genérico', () => {
    const s = emptyBoard();
    const generic = genericPort(s);
    const wood = portOf(s, 'forest');
    settleOnPort(s, 0, generic);
    settleOnPort(s, 0, wood);
    expect(tradeRate(s, 0, 'forest')).toBe(2);
    expect(tradeRate(s, 0, 'hills')).toBe(3);
  });

  it('sirve tanto el primer como el segundo vértice del puerto, y también una ciudad', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, genericPort(s), false, 1);
    expect(tradeRate(s, 0, 'fields')).toBe(3);
    const t = emptyBoard();
    settleOnPort(t, 0, genericPort(t), true, 0);
    expect(tradeRate(t, 0, 'fields')).toBe(3);
  });

  it('el puerto de otro jugador no cuenta', () => {
    const s = emptyBoard();
    settleOnPort(s, 1, portOf(s, 'forest'));
    expect(tradeRate(s, 0, 'forest')).toBe(4);
    expect(tradeRate(s, 1, 'forest')).toBe(2);
  });

  it('la tasa sale de la configuración', () => {
    const s = emptyBoard();
    s.config.trade = { bank: 5, genericPort: 4, specificPort: 3 };
    expect(tradeRate(s, 0, 'forest')).toBe(5);
    settleOnPort(s, 0, genericPort(s));
    expect(tradeRate(s, 0, 'forest')).toBe(4);
    settleOnPort(s, 0, portOf(s, 'hills'));
    expect(tradeRate(s, 0, 'hills')).toBe(3);
  });
});

describe('comercio con el banco: comando bankTrade', () => {
  it('4:1 sin puerto: entrega 4 cartas iguales y recibe 1 (el banco se actualiza)', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 5 });
    const bankBefore = { ...s.bank };
    const r = must(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'mountains' });
    expect(r.state.players[0].hand.forest).toBe(1);
    expect(r.state.players[0].hand.mountains).toBe(1);
    expect(r.state.bank.forest).toBe(bankBefore.forest + 4);
    expect(r.state.bank.mountains).toBe(bankBefore.mountains - 1);
    expect(r.events).toEqual([{ type: 'BankTraded', player: 0, give: 'forest', giveCount: 4, get: 'mountains' }]);
    expectConserved(r.state);
  });

  it('con un puerto específico cambia 2 por 1', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, portOf(s, 'pasture'));
    setHand(s, 0, { pasture: 3 });
    const r = must(s, { type: 'bankTrade', player: 0, give: 'pasture', get: 'hills' });
    expect(r.state.players[0].hand).toMatchObject({ pasture: 1, hills: 1 });
    expect(r.events[0]).toMatchObject({ giveCount: 2 });
    expectConserved(r.state);
  });

  it('con un puerto genérico cambia 3 por 1', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, genericPort(s));
    setHand(s, 0, { fields: 3 });
    const r = must(s, { type: 'bankTrade', player: 0, give: 'fields', get: 'forest' });
    expect(r.state.players[0].hand).toMatchObject({ fields: 0, forest: 1 });
  });

  it('no modifica el estado recibido', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 4 });
    const before = structuredClone(s);
    must(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' });
    expect(s).toEqual(before);
  });

  it('rechaza si no le alcanzan las cartas para la tasa', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 3 });
    expect(errorOf(applyCommand(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' }))).toBe('insufficient-resources');
    // con puerto específico sí alcanzaría, pero en otro recurso no
    settleOnPort(s, 0, portOf(s, 'hills'));
    expect(errorOf(applyCommand(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' }))).toBe('insufficient-resources');
  });

  it('rechaza pedir el mismo recurso que se entrega', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 8 });
    expect(errorOf(applyCommand(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'forest' }))).toBe('invalid-trade');
  });

  it('rechaza recursos que no existen', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 8 });
    const bad = (give: unknown, get: unknown) =>
      errorOf(applyCommand(s, { type: 'bankTrade', player: 0, give, get } as never));
    expect(bad('gold', 'hills')).toBe('invalid-trade');
    expect(bad('forest', 'desert')).toBe('invalid-trade');
    expect(bad(undefined, 'hills')).toBe('invalid-trade');
  });

  it('rechaza si el banco no tiene la carta pedida', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 4 });
    s.bank.mountains = 0;
    expect(errorOf(applyCommand(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'mountains' }))).toBe('bank-empty');
  });

  it('solo en la fase main: no antes de tirar los dados ni con un 7 pendiente', () => {
    const roll = emptyBoard();
    setHand(roll, 0, { forest: 4 });
    roll.phase = { kind: 'roll' };
    expect(errorOf(applyCommand(roll, { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' }))).toBe('wrong-phase');
    const seven = emptyBoard();
    setHand(seven, 0, { forest: 4 });
    seven.phase = { kind: 'moveRobber' };
    expect(errorOf(applyCommand(seven, { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' }))).toBe('wrong-phase');
  });

  it('solo en el turno del jugador', () => {
    const s = emptyBoard();
    setHand(s, 1, { forest: 4 });
    expect(errorOf(applyCommand(s, { type: 'bankTrade', player: 1, give: 'forest', get: 'hills' }))).toBe('not-your-turn');
  });

  it('se puede repetir en el mismo turno', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 8 });
    const a = must(s, { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' });
    const b = must(a.state, { type: 'bankTrade', player: 0, give: 'forest', get: 'fields' });
    expect(b.state.players[0].hand).toMatchObject({ forest: 0, hills: 1, fields: 1 });
    expectConserved(b.state);
  });
});

describe('comercio con el banco: acciones legales', () => {
  it('sin cartas suficientes no aparece bankTrade', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 3 });
    expect(legalActions(s, 0).some((a) => a.type === 'bankTrade')).toBe(false);
    expect(bankTradeOptions(s, 0)).toEqual([]);
  });

  it('lista cada recurso que se puede entregar con su tasa y todos los recursos distintos que se pueden pedir', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, portOf(s, 'forest'));
    setHand(s, 0, { forest: 2, hills: 4 });
    const a = legalActions(s, 0).find((x) => x.type === 'bankTrade');
    expect(a).toBeDefined();
    if (a?.type !== 'bankTrade') return;
    expect(a.trades.map((t) => [t.give, t.rate]).sort()).toEqual([['forest', 2], ['hills', 4]]);
    for (const t of a.trades) expect(t.get.sort()).toEqual(RESOURCES.filter((r) => r !== t.give).sort());
  });

  it('no ofrece pedir lo que el banco no tiene', () => {
    const s = emptyBoard();
    setHand(s, 0, { hills: 4 });
    s.bank.mountains = 0;
    const [t] = bankTradeOptions(s, 0);
    expect(t.get).not.toContain('mountains');
    expect(t.get).toContain('forest');
  });

  it('solo aparece en fase main y para el jugador de turno', () => {
    const s = emptyBoard();
    setHand(s, 0, { forest: 4 });
    setHand(s, 1, { forest: 4 });
    expect(legalActions(s, 1)).toEqual([]);
    s.phase = { kind: 'roll' };
    expect(legalActions(s, 0).some((a) => a.type === 'bankTrade')).toBe(false);
  });

  it('todo lo que se anuncia como legal, el motor lo acepta', () => {
    const s = emptyBoard();
    settleOnPort(s, 0, genericPort(s));
    setHand(s, 0, { forest: 3, hills: 4, pasture: 5, fields: 2 });
    for (const a of legalActions(s, 0)) {
      if (a.type !== 'bankTrade') continue;
      for (const t of a.trades) for (const get of t.get) {
        const r = applyCommand(s, { type: 'bankTrade', player: 0, give: t.give, get });
        expect(r.ok).toBe(true);
        if (r.ok) expectConserved(r.state);
      }
    }
  });
});
