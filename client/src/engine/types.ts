// Tipos del estado de la partida, comandos y eventos. Todo es JSON puro (se guarda tal cual en Redis/Neon).

import type { GameMap, Resource } from './map';

export type PlayerId = number; // índice del jugador en el orden de mesa (0 = primero)
export type Hand = Record<Resource, number>;
export type Cost = Partial<Record<Resource, number>>;

export interface GameConfig {
  players: number; // 3 o 4
  victoryPoints: number;
  bankPerResource: number; // cartas de cada recurso en el banco
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
  dice: { seed: number; rolls: number }; // cada tirada sale de seed + contador (ver rules/dice.ts)
}

// ---------------------------------------------------------------- comandos (intenciones del jugador)

export type Command =
  | { type: 'placeSettlement'; player: PlayerId; vertex: number }
  | { type: 'placeRoad'; player: PlayerId; edge: number }
  | { type: 'rollDice'; player: PlayerId }
  | { type: 'endTurn'; player: PlayerId };

// ---------------------------------------------------------------- eventos (lo que el servidor confirma)

export interface Gain {
  player: PlayerId;
  resource: Resource;
  amount: number;
}

export type GameEvent =
  | { type: 'SettlementBuilt'; player: PlayerId; vertex: number }
  | { type: 'RoadBuilt'; player: PlayerId; edge: number }
  | { type: 'DiceRolled'; player: PlayerId; dice: [number, number]; total: number }
  | { type: 'ResourcesDistributed'; gains: Gain[] }
  | { type: 'TurnChanged'; player: PlayerId; phase: 'setup' | 'roll' };

// ---------------------------------------------------------------- resultados

export type ErrorCode =
  | 'game-finished'
  | 'unknown-player'
  | 'not-your-turn'
  | 'wrong-phase'
  | 'invalid-vertex'
  | 'invalid-edge'
  | 'occupied'
  | 'too-close'
  | 'not-connected';

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
  | { type: 'endTurn' };
