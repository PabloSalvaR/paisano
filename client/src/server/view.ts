// Vista filtrada: lo que un jugador puede ver de la sala. Es lo único que sale del servidor.
// Se oculta: las manos rivales (solo la cantidad), las semillas de dados y robos (permitirían predecir el azar),
// el recurso robado cuando el jugador no es ni el ladrón ni la víctima, y de las cartas de desarrollo el mazo (solo se
// cuenta cuántas quedan), las cartas ajenas (solo cuántas), qué carta compró otro y los puntos de victoria ocultos ajenos.

import { legalActions, longestRoad as roadLengthOf, publicVictoryPoints, victoryPoints } from '../engine';
import type { DevCardKind, DevHand, GameEvent, GameState, Hand, LegalAction, PlayerId, Resource } from '../engine';
import type { LoggedEvent, Room } from './room';

export interface PlayerView {
  name: string;
  handCount: number;
  devCount: number; // cartas de desarrollo en la mano (cuántas, no cuáles)
  knights: number; // caballeros ya jugados (público)
  roadLength: number; // su ruta más larga hoy (público: los caminos están a la vista)
  points: number; // los que ve todo el mundo; el de quien mira incluye sus Puntos de victoria
}

export type GameView = Pick<GameState, 'config' | 'map' | 'bank' | 'vertexBuildings' | 'edgeRoads' | 'robber' | 'phase' | 'turn' | 'longestRoad' | 'largestArmy' | 'opening' | 'trade'> & {
  players: PlayerView[];
  hand: Hand; // la mano de quien mira
  dev: { hand: DevHand; fresh: DevHand; played: boolean }; // sus cartas de desarrollo; `fresh`: las compradas este turno (no jugables)
  deckCount: number; // cuántas cartas quedan en el mazo de desarrollo
};

/** Como GameEvent, pero `Stolen` puede traer el recurso oculto y `DevCardBought` el tipo de carta (null). */
export type ViewEvent =
  | Exclude<GameEvent, { type: 'Stolen' | 'DevCardBought' }>
  | { type: 'Stolen'; thief: PlayerId; victim: PlayerId; resource: Resource | null }
  | { type: 'DevCardBought'; player: PlayerId; kind: DevCardKind | null };

export interface RoomView {
  roomId: string;
  version: number;
  status: Room['status'];
  seats: { name: string; bot: boolean }[];
  me: PlayerId;
  game: GameView | null;
  legal: LegalAction[]; // calculadas por el servidor: el cliente solo muestra esto
  events: { version: number; event: ViewEvent }[]; // lo ocurrido después de `since`
}

export function viewEvent(event: GameEvent, me: PlayerId): ViewEvent {
  if (event.type === 'Stolen' && me !== event.thief && me !== event.victim) return { ...event, resource: null };
  if (event.type === 'DevCardBought' && me !== event.player) return { ...event, kind: null };
  return event;
}

export function gameView(state: GameState, me: PlayerId): GameView {
  const { players, config, map, bank, vertexBuildings, edgeRoads, robber, phase, turn, longestRoad, largestArmy, opening, trade } = state; // lista explícita: un campo nuevo del estado no sale por defecto
  return {
    config,
    map,
    bank,
    vertexBuildings,
    edgeRoads,
    robber,
    phase,
    turn,
    longestRoad,
    largestArmy,
    opening, // el sorteo de quién abre es público
    trade: trade ?? null, // la oferta de comercio abierta es pública (qué se ofrece y quién ya respondió)
    players: players.map((p, id) => ({
      name: p.name,
      handCount: Object.values(p.hand).reduce((n, c) => n + c, 0),
      devCount: Object.values(p.dev).reduce((n, c) => n + c, 0),
      knights: p.knightsPlayed,
      roadLength: roadLengthOf(state, id),
      points: id === me ? victoryPoints(state, id) : publicVictoryPoints(state, id),
    })),
    hand: { ...players[me].hand },
    dev: { hand: { ...players[me].dev }, fresh: { ...players[me].devNew }, played: state.devPlayed },
    deckCount: state.devDeck.length,
  };
}

export function roomView(room: Room, me: PlayerId, since = 0): RoomView {
  const events = room.log.filter((l: LoggedEvent) => l.version > since).map((l) => ({ version: l.version, event: viewEvent(l.event, me) }));
  return {
    roomId: room.id,
    version: room.version,
    status: room.status,
    seats: room.seats.map((s) => ({ name: s.name, bot: s.bot })),
    me,
    game: room.state ? gameView(room.state, me) : null,
    legal: room.state ? legalActions(room.state, me) : [],
    events,
  };
}
