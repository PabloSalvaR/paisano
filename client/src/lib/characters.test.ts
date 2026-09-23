import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine';
import { CHARACTERS, DEFAULT_CAST, DEFAULT_CHARACTER_ID, PORTRAIT_COLORS, characterById, drawBotCharacters, portraitURL } from './characters';

describe('personajes', () => {
  it('12 personajes con id y nombre únicos, y cada uno con su retrato en public/ en los 4 colores de asiento', () => {
    expect(CHARACTERS).toHaveLength(12);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(12);
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(12);
    for (const c of CHARACTERS) for (const color of PORTRAIT_COLORS) expect(existsSync(join(__dirname, '../../public', portraitURL(c.id, color)))).toBe(true);
    expect(portraitURL('juan', 'violeta')).toBe(portraitURL('juan', 'red')); // un color desconocido cae en el rojo
    expect(characterById(DEFAULT_CHARACTER_ID)).toBeDefined();
    for (const id of DEFAULT_CAST) expect(characterById(id)).toBeDefined();
    expect(characterById('tomas')).toBeUndefined(); // los ids del catálogo viejo ya no existen
  });

  it('los bots salen distintos, sin tu personaje ni uno que se llame como vos (sin mirar tildes)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const bots = drawBotCharacters(3, 'juan', 'Jose', mulberry32(seed));
      expect(bots).toHaveLength(3);
      expect(new Set(bots.map((c) => c.id)).size).toBe(3);
      expect(bots.some((c) => c.id === 'juan' || c.id === 'jose')).toBe(false);
    }
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) drawBotCharacters(3, 'juan', 'Pablo', mulberry32(seed)).forEach((c) => seen.add(c.id));
    expect(seen.size).toBe(11); // con el tiempo salen todos menos el tuyo
  });
});
