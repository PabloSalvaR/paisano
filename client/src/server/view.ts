// Vista filtrada: lo que un jugador puede ver de la sala. Es lo único que sale del servidor.
// Se oculta: las manos rivales (solo la cantidad), las semillas de dados y robos (permitirían predecir el azar)
// y el recurso robado cuando el jugador no es ni el ladrón ni la víctima.

import { legalActions, victoryPoints } from '../engine';
import type { GameEvent, GameState, Hand, LegalAction, PlayerId, Resource } from '../engine';
import type { LoggedEvent, Room } from './room';

export interface PlayerView {
  name: string;
  handCount: number;
  points: number;
}

export type GameView = Pick<GameState, 'config' | 'map' | 'bank' | 'vertexBuildings' | 'edgeRoads' | 'robber' | 'phase' | 'turn'> & {
  players: PlayerView[];
  hand: Hand; // la mano de quien mira
};

/** Como GameEvent, pero `Stolen` puede traer el recurso oculto (null). */
export type ViewEvent = Exclude<GameEvent, { type: 'Stolen' }> | { type: 'Stolen'; thief: PlayerId; victim: PlayerId; resource: Resource | null };

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
  return event;
}

export function gameView(state: GameState, me: PlayerId): GameView {
  const { players, config, map, bank, vertexBuildings, edgeRoads, robber, phase, turn } = state; // lista explícita: un campo nuevo del estado no sale por defecto
  return {
    config,
    map,
    bank,
    vertexBuildings,
    edgeRoads,
    robber,
    phase,
    turn,
    players: players.map((p, id) => ({ name: p.name, handCount: Object.values(p.hand).reduce((n, c) => n + c, 0), points: victoryPoints(state, id) })),
    hand: { ...players[me].hand },
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
