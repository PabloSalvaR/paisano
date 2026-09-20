// Valores por defecto de las reglas: los del juego base. Cada opción se podrá cambiar por sala (GameConfig).

import type { GameConfig } from './types';

export function defaultConfig(players: number): GameConfig {
  return {
    players,
    victoryPoints: 10,
    bankPerResource: 19,
    costs: {
      road: { forest: 1, hills: 1 },
      settlement: { forest: 1, hills: 1, pasture: 1, fields: 1 },
      city: { fields: 2, mountains: 3 },
      developmentCard: { pasture: 1, fields: 1, mountains: 1 },
    },
    maxPieces: { roads: 15, settlements: 5, cities: 4 },
  };
}
