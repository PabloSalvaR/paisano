// Documento de una sala: es lo único que se guarda en el almacén (JSON puro, uno por sala).
// Vive solo en el servidor: contiene las semillas de la partida y los hashes de los tokens, y nunca se envía tal cual.

import type { GameEvent, GameState } from '../engine';

export interface Seat {
  name: string;
  tokenHash: string | null; // hash del token del navegador; null en los asientos de bot
  bot: boolean;
}

export interface LoggedEvent {
  version: number; // versión de la sala en la que ocurrió (para que el cliente pida «lo que pasó desde X»)
  event: GameEvent;
}

export interface Room {
  id: string;
  status: 'lobby' | 'playing';
  seats: Seat[]; // el índice es el PlayerId; el asiento 0 es el anfitrión
  state: GameState | null; // null mientras está en el lobby
  log: LoggedEvent[]; // últimos eventos (acotado por LOG_LIMIT)
  version: number; // sube en cada guardado; el almacén solo guarda si nadie más lo cambió
}

export const MIN_SEATS = 3;
export const MAX_SEATS = 4;
export const LOG_LIMIT = 200;
