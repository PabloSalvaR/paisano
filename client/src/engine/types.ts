// Tipos del estado de la partida, comandos y eventos. Todo es JSON puro (se guarda tal cual en Redis/Neon).

import type { GameMap, Resource } from './map';

export type PlayerId = number; // índice del jugador en el orden de mesa (0 = primero)
export type Hand = Record<Resource, number>;
export type Cost = Partial<Record<Resource, number>>;

export interface GameConfig {
  players: number; // 3 o 4
  victoryPoints: number;
  bankPerResource: number; // cartas de cada recurso en el banco
  discardLimit: number; // con un 7, quien tiene MÁS de estas cartas descarta la mitad
  costs: { road: Cost; settlement: Cost; city: Cost; developmentCard: Cost };
  maxPieces: { roads: number; settlements: number; cities: number };
}

export interface PlayerState {
  name: string;
  hand: Hand;
}

export interface Building {
  player: PlayerId;
  city: boolean;
}

export type Phase =
  // Colocación inicial: 2n pasos en el orden 0..n-1 y luego n-1..0. En cada paso, un poblado y después un camino.
  | { kind: 'setup'; step: number; part: 'settlement' | 'road'; lastSettlement: number | null }
  | { kind: 'roll' } // turno normal: falta tirar los dados
  | { kind: 'main' } // turno normal: ya se tiró (construir, comerciar, terminar turno)
  // Con un 7: cada jugador con más de `discardLimit` cartas descarta la mitad (de a uno, en el orden de la cola;
  // `turn` es el que descarta), después quien tiró mueve al ladrón y, si corresponde, roba.
  | { kind: 'discard'; roller: PlayerId; queue: { player: PlayerId; count: number }[] }
  | { kind: 'moveRobber' }
  | { kind: 'steal'; victims: PlayerId[] } // hay que elegir a quién robarle (más de un candidato)
  | { kind: 'finished'; winner: PlayerId };

export interface GameState {
  config: GameConfig;
  map: GameMap;
  players: PlayerState[];
  bank: Hand;
  vertexBuildings: (Building | null)[]; // por id de vértice
  edgeRoads: (PlayerId | null)[]; // por id de arista
  robber: number; // id de casilla
  phase: Phase;
  turn: PlayerId; // a quién le toca actuar
  dice: { seed: number; rolls: number }; // cada tirada sale de seed + contador (ver dice.ts)
  random: { seed: number; count: number }; // otros sorteos (robo de cartas): mismo esquema que los dados, flujo aparte
}

// ---------------------------------------------------------------- comandos (intenciones del jugador)

export type Command =
  | { type: 'placeSettlement'; player: PlayerId; vertex: number } // colocación inicial (gratis)
  | { type: 'placeRoad'; player: PlayerId; edge: number } // colocación inicial (gratis)
  | { type: 'rollDice'; player: PlayerId }
  | { type: 'buildRoad'; player: PlayerId; edge: number }
  | { type: 'buildSettlement'; player: PlayerId; vertex: number }
  | { type: 'buildCity'; player: PlayerId; vertex: number }
  | { type: 'discard'; player: PlayerId; cards: Partial<Hand> }
  | { type: 'moveRobber'; player: PlayerId; tile: number }
  | { type: 'steal'; player: PlayerId; victim: PlayerId }
  | { type: 'endTurn'; player: PlayerId };

// ---------------------------------------------------------------- eventos (lo que el servidor confirma)

export interface Gain {
  player: PlayerId;
  resource: Resource;
  amount: number;
}

export type GameEvent =
  | { type: 'SettlementBuilt'; player: PlayerId; vertex: number }
  | { type: 'CityBuilt'; player: PlayerId; vertex: number }
  | { type: 'RoadBuilt'; player: PlayerId; edge: number }
  | { type: 'DiceRolled'; player: PlayerId; dice: [number, number]; total: number }
  | { type: 'ResourcesDistributed'; gains: Gain[] }
  | { type: 'ResourcesSpent'; player: PlayerId; cost: Cost } // lo que se pagó al banco al construir
  | { type: 'DiscardRequired'; players: { player: PlayerId; count: number }[] }
  | { type: 'Discarded'; player: PlayerId; cards: Partial<Hand> }
  | { type: 'RobberMoved'; player: PlayerId; tile: number }
  | { type: 'Stolen'; thief: PlayerId; victim: PlayerId; resource: Resource } // el recurso solo lo ven los dos implicados
  | { type: 'TurnChanged'; player: PlayerId; phase: 'setup' | 'roll' }
  | { type: 'GameWon'; player: PlayerId; points: number };

// ---------------------------------------------------------------- resultados

export type ErrorCode =
  | 'game-finished'
  | 'unknown-player'
  | 'not-your-turn'
  | 'wrong-phase'
  | 'invalid-vertex'
  | 'invalid-edge'
  | 'invalid-tile'
  | 'invalid-target'
  | 'invalid-victim'
  | 'invalid-discard'
  | 'occupied'
  | 'too-close'
  | 'not-connected'
  | 'insufficient-resources'
  | 'no-pieces-left'
  | 'same-tile';

export interface GameError {
  code: ErrorCode;
  message: string;
}

export type Result =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: GameError };

/** Lo que un jugador puede hacer ahora mismo. El cliente solo muestra esto; no duplica reglas. */
export type LegalAction =
  | { type: 'placeSettlement'; vertices: number[] }
  | { type: 'placeRoad'; edges: number[] }
  | { type: 'rollDice' }
  | { type: 'buildRoad'; edges: number[] } // solo aparece si alcanzan los recursos y quedan piezas
  | { type: 'buildSettlement'; vertices: number[] }
  | { type: 'buildCity'; vertices: number[] }
  | { type: 'discard'; count: number }
  | { type: 'moveRobber'; tiles: number[] }
  | { type: 'steal'; victims: PlayerId[] }
  | { type: 'endTurn' };
