// Comercio entre jugadores: quién propone, quién responde, quién concreta, límites y que nada se cree ni se pierda.

import { describe, expect, it } from 'vitest';
import { applyCommand, legalActions } from './game';
import { errorOf, expectConserved, mainPhaseGame, must, setHand } from './testutil';
import type { GameState } from './types';

/** Turno del 0 en fase main: el 0 tiene 2 madera y 1 maíz; el 1 tiene 2 piedra; el 2 tiene 1 ladrillo; el 3 nada. */
function table(players = 4): GameState {
  const s = mainPhaseGame(8, ['A', 'B', 'C', 'D'].slice(0, players));
  setHand(s, 0, { forest: 2, fields: 1 });
  setHand(s, 1, { mountains: 2 });
  setHand(s, 2, { hills: 1 });
  return s;
}
const offer = (s: GameState, to?: number[]) => must(s, { type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { mountains: 1 }, to }).state;

describe('comercio entre jugadores: proponer', () => {
  it('abre una oferta a todos los demás, con una respuesta pendiente por jugador', () => {
    const r = must(table(), { type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { mountains: 1 } });
    expect(r.events).toEqual([{ type: 'TradeProposed', player: 0, give: { forest: 1 }, get: { mountains: 1 }, to: [1, 2, 3] }]);
    expect(r.state.trade!.responses.map((x) => x.status)).toEqual(['pending', 'pending', 'pending']);
    expect(r.state.tradeOffers).toBe(1);
  });

  it('puede dirigirse a algunos jugadores', () => {
    expect(offer(table(), [2, 1]).trade!.responses.map((x) => x.player)).toEqual([1, 2]);
  });

  it('rechaza ofertas mal armadas con un error claro', () => {
    const s = table();
    const propose = (give: object, get: object, to?: number[]) => errorOf(applyCommand(s, { type: 'proposeTrade', player: 0, give, get, to }));
    expect(propose({}, { mountains: 1 })).toBe('invalid-trade'); // sin regalos ni pedir gratis
    expect(propose({ forest: 1 }, {})).toBe('invalid-trade');
    expect(propose({ forest: 1 }, { forest: 1 })).toBe('invalid-trade'); // mismo recurso de los dos lados
    expect(propose({ forest: -1 }, { hills: 1 })).toBe('invalid-trade');
    expect(propose({ forest: 1.5 }, { hills: 1 })).toBe('invalid-trade');
    expect(propose({ oro: 1 }, { hills: 1 })).toBe('invalid-trade');
    expect(propose({ mountains: 1 }, { hills: 1 })).toBe('insufficient-resources'); // no tiene lo que ofrece
    expect(propose({ forest: 3 }, { hills: 1 })).toBe('insufficient-resources');
    expect(propose({ forest: 1 }, { hills: 1 }, [])).toBe('invalid-target');
    expect(propose({ forest: 1 }, { hills: 1 }, [0])).toBe('invalid-target'); // uno mismo
    expect(propose({ forest: 1 }, { hills: 1 }, [1, 1])).toBe('invalid-target');
    expect(propose({ forest: 1 }, { hills: 1 }, [9])).toBe('invalid-target');
  });

  it('solo en fase main y solo el jugador de turno', () => {
    const s = table();
    expect(errorOf(applyCommand(s, { type: 'proposeTrade', player: 1, give: { mountains: 1 }, get: { forest: 1 } }))).toBe('not-your-turn');
    s.phase = { kind: 'roll' };
    expect(errorOf(applyCommand(s, { type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { hills: 1 } }))).toBe('wrong-phase');
  });

  it('una sola oferta abierta a la vez', () => {
    expect(errorOf(applyCommand(offer(table()), { type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { hills: 1 } }))).toBe('trade-open');
  });

  it('tiene un tope de ofertas por turno, que se reinicia al cambiar de turno', () => {
    let s = table();
    s.config.trade.maxOffersPerTurn = 2;
    for (let i = 0; i < 2; i++) s = must(offer(s), { type: 'cancelTrade', player: 0 }).state;
    expect(errorOf(applyCommand(s, { type: 'proposeTrade', player: 0, give: { forest: 1 }, get: { hills: 1 } }))).toBe('trade-limit');
    expect(legalActions(s, 0).some((a) => a.type === 'proposeTrade')).toBe(false);
    s = must(s, { type: 'endTurn', player: 0 }).state;
    expect(s.tradeOffers).toBe(0);
  });
});

describe('comercio entre jugadores: responder y concretar', () => {
  it('los demás pueden responder fuera de turno; el de turno no', () => {
    const s = offer(table());
    expect(legalActions(s, 1)).toEqual([{ type: 'respondTrade', canAccept: true }]);
    expect(legalActions(s, 3)).toEqual([{ type: 'respondTrade', canAccept: false }]); // no tiene piedra
    expect(errorOf(applyCommand(s, { type: 'respondTrade', player: 0, accept: true }))).toBe('invalid-target');
  });

  it('no se puede aceptar sin tener lo que piden, ni responder dos veces, ni si la oferta no era para uno', () => {
    let s = offer(table(), [1, 2]);
    expect(errorOf(applyCommand(s, { type: 'respondTrade', player: 2, accept: true }))).toBe('insufficient-resources');
    expect(errorOf(applyCommand(s, { type: 'respondTrade', player: 3, accept: false }))).toBe('invalid-target');
    s = must(s, { type: 'respondTrade', player: 1, accept: true }).state;
    expect(errorOf(applyCommand(s, { type: 'respondTrade', player: 1, accept: false }))).toBe('invalid-trade');
  });

  it('quien propuso elige con cuál de los que aceptaron concreta, y las cartas cambian de mano', () => {
    let s = table();
    setHand(s, 3, { mountains: 1 });
    s = offer(s);
    s = must(s, { type: 'respondTrade', player: 1, accept: true }).state;
    s = must(s, { type: 'respondTrade', player: 3, accept: true }).state;
    expect(legalActions(s, 0)).toEqual([{ type: 'confirmTrade', with: [1, 3] }, { type: 'cancelTrade' }]);
    const r = must(s, { type: 'confirmTrade', player: 0, with: 3 });
    expect(r.events).toEqual([{ type: 'TradeCompleted', player: 0, with: 3, give: { forest: 1 }, get: { mountains: 1 } }]);
    expect(r.state.trade).toBeNull();
    expect(r.state.players[0].hand).toMatchObject({ forest: 1, mountains: 1, fields: 1 });
    expect(r.state.players[3].hand).toMatchObject({ forest: 1, mountains: 0 });
    expect(r.state.players[1].hand.mountains).toBe(2); // el otro que aceptó no pierde nada
    expectConserved(r.state);
  });

  it('solo se concreta con quien aceptó, y solo lo hace quien propuso', () => {
    let s = offer(table());
    expect(errorOf(applyCommand(s, { type: 'confirmTrade', player: 0, with: 1 }))).toBe('invalid-target'); // todavía pendiente
    s = must(s, { type: 'respondTrade', player: 1, accept: true }).state;
    expect(errorOf(applyCommand(s, { type: 'confirmTrade', player: 1, with: 1 }))).toBe('not-your-turn');
    expect(errorOf(applyCommand(s, { type: 'cancelTrade', player: 1 }))).toBe('not-your-turn');
    expect(errorOf(applyCommand(s, { type: 'confirmTrade', player: 0, with: 2 }))).toBe('invalid-target');
  });

  it('si todos rechazan, la oferta se cierra sola', () => {
    let s = offer(table(3));
    s = must(s, { type: 'respondTrade', player: 1, accept: false }).state;
    expect(s.trade).not.toBeNull();
    const r = must(s, { type: 'respondTrade', player: 2, accept: false });
    expect(r.state.trade).toBeNull();
    expect(r.events.at(-1)).toEqual({ type: 'TradeCancelled', player: 0, reason: 'rejected' });
    expect(legalActions(r.state, 0).some((a) => a.type === 'proposeTrade')).toBe(true); // ya puede hacer otra
  });

  it('cancelar la oferta la cierra sin mover cartas', () => {
    const s = offer(table());
    const r = must(s, { type: 'cancelTrade', player: 0 });
    expect(r.state.trade).toBeNull();
    expect(r.state.players).toEqual(s.players);
  });
});

describe('comercio entre jugadores: mientras hay una oferta abierta', () => {
  it('el de turno no puede construir, comprar, comerciar con el banco ni terminar el turno', () => {
    const s = offer(table());
    setHand(s, 0, { forest: 5, hills: 5, pasture: 5, fields: 5, mountains: 5 });
    for (const cmd of [
      { type: 'endTurn', player: 0 },
      { type: 'buyDevCard', player: 0 },
      { type: 'bankTrade', player: 0, give: 'forest', get: 'hills' },
      { type: 'buildRoad', player: 0, edge: 0 },
    ] as const) {
      expect(errorOf(applyCommand(s, cmd))).toBe('trade-open');
    }
    expect(legalActions(s, 0).map((a) => a.type)).toEqual(['cancelTrade']);
  });

  it('sin oferta abierta, responder da un error claro', () => {
    expect(errorOf(applyCommand(table(), { type: 'respondTrade', player: 1, accept: true }))).toBe('no-trade');
  });

  it('con la mano vacía no se ofrece proponer', () => {
    const s = table();
    setHand(s, 0, {});
    expect(legalActions(s, 0).some((a) => a.type === 'proposeTrade')).toBe(false);
  });
});
