// Dados: cada tirada se calcula a partir de seed + contador de tiradas, así el estado no necesita guardar un generador
// en memoria (en Vercel cada petición puede caer en otra instancia) y la partida se puede reproducir.

import { mulberry32 } from './rng';

export function rollDiceFor(seed: number, rollIndex: number): [number, number] {
  const rng = mulberry32((seed + Math.imul(rollIndex + 1, 0x9e3779b1)) | 0);
  rng(); // se descarta la primera salida: semillas consecutivas dan primeras salidas muy parecidas
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}
