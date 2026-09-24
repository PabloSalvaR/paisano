// Valores por defecto de las reglas: los del juego base. Cada opción se podrá cambiar por sala (GameConfig).

import type { GameConfig } from './types';

export function defaultConfig(players: number): GameConfig {
  return {
    players,
    victoryPoints: 10,
    bankPerResource: 19,
    discardLimit: 7,
    costs: {
      road: { forest: 1, hills: 1 },
      settlement: { forest: 1, hills: 1, pasture: 1, fields: 1 },
      city: { fields: 2, mountains: 3 },
      developmentCard: { pasture: 1, fields: 1, mountains: 1 },
    },
    maxPieces: { roads: 15, settlements: 5, cities: 4 },
    trade: { bank: 4, genericPort: 3, specificPort: 2, maxOffersPerTurn: 5 },
    devDeck: { knight: 14, victoryPoint: 5, monopoly: 2, yearOfPlenty: 2, roadBuilding: 2 },
    longestRoadMin: 5,
    largestArmyMin: 3,
    awardPoints: 2,
    numberPlacement: 'spiral', // como el juego base; 'random' es el modo «Anarquía»
    firstPlayer: 0, // en las partidas reales se pasa null: se sortea con la semilla
  };
}
