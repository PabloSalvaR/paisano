// Perfil según el tablero: cada bot elige, al poner su segunda casa, el perfil al que mejor le queda lo que tiene y lo que está libre.

import { describe, expect, it } from 'vitest';
import { createGame, mulberry32, topology } from '../engine';
import { NAMES } from '../engine/testutil';
import { chooseProfile, profileFit } from './adaptive';
import type { BotProfileId } from './profiles';

const ALL: BotProfileId[] = ['balanced', 'rancher', 'settler'];
const touches = (s: ReturnType<typeof createGame>, v: number, kinds: string[]) => topology().vertices[v].tiles.some((t) => kinds.includes(s.map.terrains[t]));

describe('perfil según el tablero', () => {
  it('siempre devuelve uno de los disponibles', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = createGame(NAMES.slice(0, 3), seed);
      const spots = topology().vertices.map((_, v) => v);
      expect(ALL).toContain(chooseProfile(s, spots, ALL, mulberry32(seed)));
      expect(chooseProfile(s, spots, ['settler'], mulberry32(seed))).toBe('settler');
      expect(['balanced', 'settler']).toContain(chooseProfile(s, spots, ['balanced', 'settler'], mulberry32(seed)));
    }
  });

  it('el mejor lugar del mapa entero le queda perfecto a cada perfil (encaje 1)', () => {
    const s = createGame(NAMES.slice(0, 3), 3);
    const spots = topology().vertices.map((_, v) => v);
    for (const id of ALL) expect(profileFit(s, spots, id)).toBeCloseTo(1);
  });

  it('si queda libre el mejor lugar de piedra y maíz del mapa, es estanciero; si no queda ni piedra ni maíz, no', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame(NAMES.slice(0, 3), seed);
      const verts = topology().vertices.map((_, v) => v);
      const ranchBest = verts.filter((v) => profileFit(s, [v], 'rancher') > 0.999);
      expect(chooseProfile(s, ranchBest, ALL, mulberry32(seed))).toBe('rancher');
      const noOreWheat = verts.filter((v) => !touches(s, v, ['mountains', 'fields']));
      expect(chooseProfile(s, noOreWheat, ALL, mulberry32(seed))).not.toBe('rancher');
    }
  });
});
