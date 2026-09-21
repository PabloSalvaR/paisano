// Tipos del estado de la partida, comandos y eventos. Todo es JSON puro (se guarda tal cual en Redis/Neon).

import type { GameMap, Resource } from './map';

export type PlayerId = number; // índice del jugador en el orden de mesa (0 = primero)
export type Hand = Record<Resource, number>;
export type Cost = Partial<Record<Resource, number>>;

/** Cartas de desarrollo. En pantalla: Gaucho (knight), Acopio (monopoly), Buena cosecha (yearOfPlenty), Vialidad (roadBuilding), Punto de victoria (victoryPoint). */
export type DevCardKind = 'knight' | 'monopoly' | 'yearOfPlenty' | 'roadBuilding' | 'victoryPoint';
export type DevHand = Record<DevCardKind, number>;

export interface GameConfig {
  players: number; // 3 o 4
  victoryPoints: number;
  bankPerResource: number; // cartas de cada recurso en el banco
  discardLimit: number; // con un 7, quien tiene MÁS de estas cartas descarta la mitad
  costs: { road: Cost; settlement: Cost; city: Cost; developmentCard: Cost };
  maxPieces: { roads: number; settlements: number; cities: number };
  trade: { bank: number; genericPort: number; specificPort: number }; // cartas iguales que se entregan por 1 del banco
  devDeck: DevHand; // composición del mazo de desarrollo
  longestRoadMin: number; // largo mínimo para el reconocimiento de la ruta más larga
  largestArmyMin: number; // caballeros jugados mínimos para el de la montonera más grande
  awardPoints: number; // puntos de cada reconocimiento
  firstPlayer: PlayerId | null; // quién abre la colocación y la partida; null = se sortea con la semilla
}

export interface PlayerState {
  name: string;
  hand: Hand;
  dev: DevHand; // cartas de desarrollo en la mano (incluye las de este turno y las de punto, que no se juegan)
  devNew: DevHand; // las compradas en este turno: todavía no se pueden jugar
  knightsPlayed: number;
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
  | { kind: 'moveRobber'; after: 'roll' | 'main' } // `after`: fase a la que se vuelve (con un caballero antes de tirar, `roll`)
  | { kind: 'steal'; victims: PlayerId[]; after: 'roll' | 'main' } // hay que elegir a quién robarle (más de un candidato)
  | { kind: 'roadBuilding'; left: number; after: 'roll' | 'main' } // carta Vialidad: caminos gratis que faltan poner; `after`: fase a la que se vuelve (antes de tirar, `roll`)

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
  first: PlayerId; // quien abrió la colocación inicial (y el primer turno); el orden de mesa es el horario
  turn: PlayerId; // a quién le toca actuar
  dice: { seed: number; rolls: number }; // cada tirada sale de seed + contador (ver dice.ts)
  random: { seed: number; count: number }; // otros sorteos (robo de cartas): mismo esquema que los dados, flujo aparte
  devDeck: DevCardKind[]; // mazo de desarrollo barajado; se roba del final. Nunca sale del servidor
  devPlayed: boolean; // en este turno ya se jugó una carta (las de punto no cuentan)
  longestRoad: { holder: PlayerId | null; length: number };
  largestArmy: { holder: PlayerId | null; size: number };
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
  | { type: 'bankTrade'; player: PlayerId; give: Resource; get: Resource } // entrega `tasa` cartas de `give` y recibe 1 de `get`
  | { type: 'buyDevCard'; player: PlayerId }
  | { type: 'playKnight'; player: PlayerId }
  | { type: 'playMonopoly'; player: PlayerId; resource: Resource }
  | { type: 'playYearOfPlenty'; player: PlayerId; resources: Resource[] } // 2 recursos (1 si el banco solo tiene 1)
  | { type: 'playRoadBuilding'; player: PlayerId }
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
  | { type: 'BankTraded'; player: PlayerId; give: Resource; giveCount: number; get: Resource }
  | { type: 'DevCardBought'; player: PlayerId; kind: DevCardKind } // el tipo solo lo ve quien la compró (ver server/view.ts)
  | { type: 'KnightPlayed'; player: PlayerId }
  | { type: 'MonopolyPlayed'; player: PlayerId; resource: Resource; taken: { player: PlayerId; amount: number }[] }
  | { type: 'YearOfPlentyPlayed'; player: PlayerId; gains: Gain[] }
  | { type: 'RoadBuildingPlayed'; player: PlayerId }
  | { type: 'LongestRoadChanged'; player: PlayerId | null; from: PlayerId | null; length: number }
  | { type: 'LargestArmyChanged'; player: PlayerId; from: PlayerId | null; size: number }
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
  | 'bank-empty'
  | 'invalid-trade'
  | 'same-tile'
  | 'deck-empty'
  | 'no-card' // no tiene esa carta o la compró en este turno
  | 'already-played'; // ya jugó una carta en este turno

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
  | { type: 'bankTrade'; trades: { give: Resource; rate: number; get: Resource[] }[] } // qué se puede entregar (con su tasa) y qué pedir
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playMonopoly' } // el recurso lo elige el jugador (cualquiera de los 5)
  | { type: 'playYearOfPlenty'; resources: Resource[]; count: number } // recursos que el banco tiene y cuántos hay que tomar (2, o 1 si queda una sola carta)
  | { type: 'playRoadBuilding' }
  | { type: 'endTurn' };
